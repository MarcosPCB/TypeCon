import './types';

export enum CJsonType {
    Null   = 0,
    Bool   = 1,
    Int    = 2,
    FP16   = 3,
    String = 4,
    Array  = 5,
    Object = 6,
}

/**
 * CJson — recursive-descent JSON parser for TypeCON.
 *
 * Each CJson instance represents ONE parsed node.  The root is created by
 * new CJson(jsonText); child nodes returned by Find() / GetItem() are
 * lightweight views into the root's heap blocks and must NOT be Free()'d.
 *
 * Instance fields (offsets 0-4 in the heap object block):
 *   _src   (0) — pointer to the source heap string being parsed
 *   _pos   (1) — current parse cursor (character index into _src)
 *   _type  (2) — CJsonType tag of this node
 *   _val   (3) — raw int/FP16/heap-ptr value of this node
 *   _owned (4) — 1 if this instance owns its data (should Free it), 0 if a view
 *
 * Array block (pointed to by _val when _type == Array):
 *   flat[arr + 0]           = element count N
 *   flat[arr + 1 + i*2]     = type  of element i
 *   flat[arr + 1 + i*2 + 1] = value of element i
 *
 * Object block (pointed to by _val when _type == Object):
 *   flat[obj + 0]           = key count N
 *   flat[obj + 1 + i*3]     = key string pointer
 *   flat[obj + 1 + i*3 + 1] = value type
 *   flat[obj + 1 + i*3 + 2] = value
 */
export class CJson {
    private _src: string;
    private _pos: number;
    private _type: number;
    private _val: number;
    private _owned: boolean;

    /**
     * Parse json immediately.  Pass an empty string to obtain a null node
     * (used internally by GetItem / Find).
     */
    constructor(json: string) {
        this._src = json;
        this._pos = 0;
        this._type = CJsonType.Null;
        this._val = 0;
        this._owned = true;
        if (strLen(json) > 0) {
            this._skipWS();
            this._parseValue();
        }
    }

    // ── scalar accessors ──────────────────────────────────

    GetType(): number {
        return this._type;
    }

    IsNull(): boolean {
        return (this._type == CJsonType.Null) as unknown as boolean;
    }

    GetBool(): boolean {
        CONUnsafe(`
set ri flat[rbp]
add ri 3
set rd flat[ri]
set rb 0
ifn rd 0
  set rb 1
set ra rb
`);
        return sysFrame.rb as unknown as boolean;
    }

    GetInt(): number {
        if (this._type == CJsonType.FP16) {
            return fp16ToInt(this._val as unknown as FP16);
        }
        return this._val;
    }

    GetNumber(): FP16 {
        if (this._type == CJsonType.Int) {
            return intToFP16(this._val);
        }
        CONUnsafe(`
set ri flat[rbp]
add ri 3
set rb flat[ri]
set ra rb
`);
        return sysFrame.rb as unknown as FP16;
    }

    GetString(): string {
        return this._val as unknown as string;
    }

    // ── array / object navigation ─────────────────────────

    GetLength(): number {
        CONUnsafe(`
// Read count from array/object block at _val (field offset 3)
set ri flat[rbp]
add ri 3
set ri flat[ri]   // ri = _val (block ptr)
set rb flat[ri]   // rb = count
set ra rb
`);
        return sysFrame.rb;
    }

    /**
     * Returns a view CJson for array element i.
     * Do NOT call Free() on the returned node.
     */
    GetItem(index: number): CJson {
        CONUnsafe(`
// r0 = index
// Get array block ptr from _val (offset 3 in object)
set ri flat[rbp]
add ri 3
set ri flat[ri]       // ri = arr_ptr

// element at arr+1+index*2
set r4 r0
mul r4 2
add r4 1
add r4 ri             // r4 = &arr[1 + i*2]
set r5 flat[r4]       // r5 = element type
add r4 1
set r6 flat[r4]       // r6 = element val

// Allocate a 5-word CJson view block [_src=0, _pos=0, _type=r5, _val=r6, _owned=0]
set r0 5
set r1 4
state alloc
// rb = new CJson-shaped block
setarray flat[rb] 0     // _src = 0
set ri rb
add ri 1
setarray flat[ri] 0     // _pos = 0
add ri 1
setarray flat[ri] r5    // _type = element type
add ri 1
setarray flat[ri] r6    // _val  = element val
add ri 1
setarray flat[ri] 0     // _owned = 0 (view)
set ra rb               // preserve rb through the CONUnsafe epilogue (set rb ra)
`);
        return sysFrame.rb as unknown as CJson;
    }

    /**
     * Searches an object node for key and returns a view CJson.
     * Returns a Null node if the key is not found.
     * Do NOT call Free() on the returned node.
     */
    Find(key: string): CJson {
        CONUnsafe(`
// r0 = key string ptr
// Get object block ptr from _val (offset 3)
set ri flat[rbp]
add ri 3
set ri flat[ri]       // ri = obj_ptr
set rc flat[ri]       // rc = N (key count)

// Hash the query key (FNV-1a)
set ra -2128831035
set r4 flat[r0]
set r5 0
whilel r5 r4 {
    set ri r0
    add ri r5
    add ri 1
    xor ra flat[ri]
    mul ra 16777619
    add r5 1
}
ife ra 0
    set ra 1
set r6 ra            // r6 = query hash

// Restore obj_ptr from _val again (ri was clobbered by query hash loop)
set ri flat[rbp]
add ri 3
set ri flat[ri]
set r10 ri           // r10 = obj_ptr (stable copy; ri is clobbered by inner hash loop)

// Scan keys
set r5 0
set r7 0             // found
set r8 0
set r9 0
whilel r5 rc {
    // key entry: obj+1+i*3
    set rd r10        // use stable obj_ptr
    add rd 1
    set r4 r5
    mul r4 3
    add rd r4         // rd = &obj[1 + i*3]

    // Hash the stored key
    set r8 flat[rd]   // r8 = stored key_ptr
    set ra -2128831035
    set r4 flat[r8]
    set r9 0
    whilel r9 r4 {    // ri is clobbered here — use r10 not ri after this
        set ri r8
        add ri r9
        add ri 1
        xor ra flat[ri]
        mul ra 16777619
        add r9 1
    }
    ife ra 0
        set ra 1

    ife ra r6 {
        // Match! Read type and val
        add rd 1
        set r8 flat[rd]   // r8 = val_type
        add rd 1
        set r9 flat[rd]   // r9 = val
        set r5 rc          // exit loop
        set r7 1
    }
    ife r7 0
        add r5 1
}

// Allocate 5-word view block
set r0 5
set r1 4
state alloc
setarray flat[rb] 0
set ri rb
add ri 1
setarray flat[ri] 0
add ri 1
// _type: found ? type : Null(0)
ife r7 1
    setarray flat[ri] r8
ife r7 0
    setarray flat[ri] 0
add ri 1
// _val: found ? val : 0
ife r7 1
    setarray flat[ri] r9
ife r7 0
    setarray flat[ri] 0
add ri 1
setarray flat[ri] 0   // _owned = 0
set ra rb             // preserve rb through the CONUnsafe epilogue (set rb ra)
`);
        return sysFrame.rb as unknown as CJson;
    }

    /**
     * Returns the key string at object index i.
     */
    GetKey(index: number): string {
        CONUnsafe(`
// r0 = index
set ri flat[rbp]
add ri 3
set ri flat[ri]       // ri = obj_ptr
set rd ri
add rd 1
set r4 r0
mul r4 3
add rd r4             // rd = &obj[1 + i*3]
set rb flat[rd]       // rb = key string ptr
set ra rb
`);
        return sysFrame.rb as unknown as string;
    }

    // ── export ────────────────────────────────────────────

    /**
     * Serialise this node back to compact JSON text.
     * Returns a heap-allocated TypeCON string.
     */
    Stringify(): string {
        const t: number = this._type;
        const v: number = this._val;

        if (t == CJsonType.Null)   return 'null';
        if (t == CJsonType.Bool) {
            if (v == 1) return 'true';
            return 'false';
        }
        if (t == CJsonType.Int)    return '' + v;
        if (t == CJsonType.FP16)   return fp16ToString(v as unknown as FP16);
        if (t == CJsonType.String) return '"' + (v as unknown as string) + '"';

        if (t == CJsonType.Array) {
            let out: string = '[';
            const n: number = this.GetLength();
            let i: number = 0;
            while (i < n) {
                if (i > 0) out = out + ',';
                const child: CJson = this.GetItem(i);
                out = out + child.Stringify();
                i = i + 1;
            }
            return out + ']';
        }

        if (t == CJsonType.Object) {
            let out: string = '{';
            const n: number = this.GetLength();
            let i: number = 0;
            while (i < n) {
                if (i > 0) out = out + ',';
                const k: string = this.GetKey(i);
                out = out + '"' + k + '":';
                const child: CJson = this.GetItem(i);
                out = out + child.Stringify();
                i = i + 1;
            }
            return out + '}';
        }

        return 'null';
    }

    /**
     * Convert an Object node into a native Record<string, number> hash map.
     * Values are stored as raw integers (FP16 raw, int, bool, or heap ptr).
     * Nested JSON objects are recursively converted to nested Records.
     *
     * NOTE: child = Find(k) is called for every key (not just objects) to keep
     * the stack frame balanced across both if/else branches. TypeCON generates
     * a single `sub rsp N` cleanup after an if-else; if the two branches push
     * different numbers of locals the counter gets corrupted.
     */
    ToRecord(): Record<string, any> {
        const r: Record<string, any> = {};
        if (this._type == CJsonType.Object) {
            const n: number = this.GetLength();
            let i: number = 0;
            while (i < n) {
                const k: string = this.GetKey(i);
                const child: CJson = this.Find(k);   // push BEFORE if-else: equal stack depth in both branches
                if (this.GetTypeAt(i) == CJsonType.Object) {
                    r[k] = child.ToRecord();
                } else {
                    r[k] = this.GetValAt(i);
                }
                i = i + 1;
            }
        }
        return r;
    }

    // ── lifetime ──────────────────────────────────────────

    Free(): void {
        if (!this._owned) return;
        this._freeNode(this._type, this._val);
    }

    // ── private parser helpers ────────────────────────────

    private _skipWS(): void {
        let c: number = charCodeAt(this._src, this._pos);
        while (c == 32 || c == 9 || c == 10 || c == 13) {
            this._pos = this._pos + 1;
            c = charCodeAt(this._src, this._pos);
        }
    }

    private _peek(): number {
        return charCodeAt(this._src, this._pos);
    }

    private _parseValue(): void {
        const c: number = this._peek();

        if (c == 123) { // '{'
            this._pos = this._pos + 1;
            this._parseObject();
            return;
        }
        if (c == 91) { // '['
            this._pos = this._pos + 1;
            this._parseArray();
            return;
        }
        if (c == 34) { // '"'
            this._type = CJsonType.String;
            this._val = this._parseString() as unknown as number;
            return;
        }
        if (c == 116) { // 't' (true)
            this._type = CJsonType.Bool;
            this._val = 1;
            this._pos = this._pos + 4;
            return;
        }
        if (c == 102) { // 'f' (false)
            this._type = CJsonType.Bool;
            this._val = 0;
            this._pos = this._pos + 5;
            return;
        }
        if (c == 110) { // 'n' (null)
            this._type = CJsonType.Null;
            this._val = 0;
            this._pos = this._pos + 4;
            return;
        }
        // number (c == 45 '-' or '0'-'9')
        this._parseNumber();
    }

    private _parseString(): string {
        this._pos = this._pos + 1; // skip opening '"'
        const start: number = this._pos;
        let c: number = charCodeAt(this._src, this._pos);
        while (c != 34) { // until closing '"'
            if (c == 92) {  // '\' escape — skip next char too
                this._pos = this._pos + 1;
            }
            this._pos = this._pos + 1;
            c = charCodeAt(this._src, this._pos);
        }
        const end: number = this._pos;
        this._pos = this._pos + 1; // skip closing '"'
        // Build a heap string from the source slice [start, end)
        const len: number = end - start;
        CONUnsafe(`
// r0 = src string ptr (already in r0 from paramMap — but this is a private method,
// so we need to get _src from the object)
// Actually _src is field offset 0 of the object
set ri flat[rbp]
set r4 flat[ri]       // r4 = _src ptr

// len and start are local variables on the stack
// They are at fixed offsets from rbp that the compiler knows.
// We load them via the stack.
// Actually, the TypeCON compiler stores 'len' and 'start' as local vars;
// we access them through sysFrame or use the approach below.
`);
        // Use sysFrame to pass values to CONUnsafe
        sysFrame.r4 = len;
        sysFrame.r5 = start;
        CONUnsafe(`
// r4 = len, r5 = start
// _src is field offset 0: flat[rbp] = self ptr, flat[self+0] = _src ptr
set ri flat[rbp]
set ri flat[ri]       // ri = _src ptr
// Source data begins at ri+1 (skip length word), then + start
add ri r5
add ri 1              // ri = &flat[_src + start + 1] (first char to copy)

// Allocate dest string: 1 (length) + len words
set r0 r4
add r0 1
set r1 2
state alloc           // rb = dest string ptr

// flat[rb+0] = len
setarray flat[rb] r4
// copy flat[ri] flat[rb+1] len
set rd rb
add rd 1
copy flat[ri] flat[rd] r4
set ra rb             // preserve rb through the CONUnsafe epilogue (set rb ra)
`);
        return sysFrame.rb as unknown as string;
    }

    private _parseNumber(): void {
        const start: number = this._pos;
        let isNeg: number = 0;
        let hasDot: number = 0;
        let c: number = charCodeAt(this._src, this._pos);

        if (c == 45) { // '-'
            isNeg = 1;
            this._pos = this._pos + 1;
            c = charCodeAt(this._src, this._pos);
        }

        let _d1: number = 1;
        while (_d1 == 1) {
            if (c < 48) _d1 = 0;
            if (c > 57) _d1 = 0;
            if (_d1 == 1) {
                this._pos = this._pos + 1;
                c = charCodeAt(this._src, this._pos);
            }
        }

        let _d2: number = 0;
        if (c == 46) { // '.'
            hasDot = 1;
            this._pos = this._pos + 1;
            c = charCodeAt(this._src, this._pos);
            _d2 = 1;
            while (_d2 == 1) {
                if (c < 48) _d2 = 0;
                if (c > 57) _d2 = 0;
                if (_d2 == 1) {
                    this._pos = this._pos + 1;
                    c = charCodeAt(this._src, this._pos);
                }
            }
        }

        const end: number = this._pos;

        if (hasDot == 1) {
            // Extract substring and parse as FP16
            sysFrame.r4 = end - start;
            sysFrame.r5 = start;
            CONUnsafe(`
set ri flat[rbp]
set ri flat[ri]       // _src ptr
add ri r5
add ri 1
set r0 r4
add r0 1
set r1 2
state alloc
setarray flat[rb] r4
set rd rb
add rd 1
copy flat[ri] flat[rd] r4
set r0 rb
state _stringToFP16
set r3 rb             // r3 = FP16 raw value
state pushr1
set r0 r3
state free
state popr1
set ra r3             // preserve r3 through the CONUnsafe epilogue (set rb ra)
`);
            this._type = CJsonType.FP16;
            this._val = sysFrame.rb;
        } else {
            // Parse as integer directly
            let val: number = 0;
            let i: number = start;
            if (isNeg == 1) i = start + 1;
            while (i < end) {
                val = val * 10 + charCodeAt(this._src, i) - 48;
                i = i + 1;
            }
            if (isNeg == 1) {
                val = 0 - val;
            }
            this._type = CJsonType.Int;
            this._val = val;
        }
    }

    private _parseArray(): void {
        // Allocate array block: 1 + 16*2 = 33 words initially
        CONUnsafe(`
set r0 33
set r1 4
state alloc
setarray flat[rb] 0   // count = 0
// Store arr_ptr in object's _val (offset 3)
set ri flat[rbp]
add ri 3
setarray flat[ri] rb
`);
        this._type = CJsonType.Array;
        // Save arr_block_ptr before _parseValue() overwrites this._val
        const arrPtr: number = this._val;
        this._skipWS();

        if (this._peek() == 93) { // ']'
            this._pos = this._pos + 1;
            this._val = arrPtr;
            return;
        }

        let _arrRun: number = 1;
        while (_arrRun == 1) {
            this._parseValue();
            const eType: number = this._type;
            const eVal: number = this._val;

            // Append to array block using saved arrPtr (not this._val which was overwritten)
            sysFrame.r4 = eType;
            sysFrame.r5 = eVal;
            sysFrame.r6 = arrPtr;
            CONUnsafe(`
// r4=type, r5=val, r6=arr_ptr (saved before _parseValue ran)
set ri r6             // ri = arr_ptr (stable; no longer reads corrupted this._val)
set rc flat[ri]       // rc = count
set rd rc
mul rd 2
add rd 1
add rd ri             // rd = &arr[1 + count*2]
setarray flat[rd] r4
add rd 1
setarray flat[rd] r5
add rc 1
setarray flat[ri] rc  // count++
`);

            this._skipWS();
            const cc: number = this._peek();
            if (cc == 93) { // ']'
                this._pos = this._pos + 1;
                _arrRun = 0;
            }
            if (_arrRun == 1 && cc == 44) { // ','
                this._pos = this._pos + 1;
                this._skipWS();
            }
        }

        // Restore _type and _val (both overwritten by child parseValue calls)
        this._type = CJsonType.Array;
        this._val = arrPtr;
    }

    private _parseObject(): void {
        // Allocate object block: 1 + 16*3 = 49 words initially
        CONUnsafe(`
set r0 49
set r1 4
state alloc
setarray flat[rb] 0
set ri flat[rbp]
add ri 3
setarray flat[ri] rb
`);
        this._type = CJsonType.Object;
        // Save obj_block_ptr before _parseValue() overwrites this._val
        const objPtr: number = this._val;
        this._skipWS();

        if (this._peek() == 125) { // '}'
            this._pos = this._pos + 1;
            this._val = objPtr;
            return;
        }

        let _objRun: number = 1;
        while (_objRun == 1) {
            this._skipWS();
            const kStr: string = this._parseString();
            this._skipWS();
            this._pos = this._pos + 1; // skip ':'
            this._skipWS();
            this._parseValue();
            const vType: number = this._type;
            const vVal: number = this._val;

            // Append key+val using saved objPtr (not this._val which was overwritten)
            sysFrame.r4 = kStr as unknown as number;
            sysFrame.r5 = vType;
            sysFrame.r6 = vVal;
            sysFrame.rd = objPtr;
            CONUnsafe(`
// r4=key_ptr, r5=val_type, r6=val, rd=obj_ptr (saved before _parseValue ran)
set ri rd             // ri = obj_ptr; rd is now free for scratch
set rc flat[ri]       // rc = count
set rd rc
mul rd 3
add rd 1
add rd ri             // rd = &obj[1 + count*3]
setarray flat[rd] r4
add rd 1
setarray flat[rd] r5
add rd 1
setarray flat[rd] r6
add rc 1
setarray flat[ri] rc  // count++
`);

            this._skipWS();
            const cc: number = this._peek();
            if (cc == 125) { // '}'
                this._pos = this._pos + 1;
                _objRun = 0;
            }
            if (_objRun == 1 && cc == 44) { // ','
                this._pos = this._pos + 1;
            }
        }

        // Restore _type and _val (both overwritten by child parseValue calls)
        this._type = CJsonType.Object;
        this._val = objPtr;
    }

    // ── private indexed accessors (for ToRecord) ──────────

    private GetTypeAt(index: number): number {
        CONUnsafe(`
set ri flat[rbp]
add ri 3
set ri flat[ri]
set rd r0
mul rd 3
add rd 1
add rd ri
add rd 1
set rb flat[rd]
set ra rb
`);
        return sysFrame.rb;
    }

    private GetValAt(index: number): number {
        CONUnsafe(`
set ri flat[rbp]
add ri 3
set ri flat[ri]
set rd r0
mul rd 3
add rd 1
add rd ri
add rd 2
set rb flat[rd]
set ra rb
`);
        return sysFrame.rb;
    }

    // ── private recursive free ────────────────────────────

    private _freeNode(type: number, val: number): void {
        if (type == CJsonType.String) {
            CONUnsafe(`
set r0 r1
state free
`);
            return;
        }
        if (type == CJsonType.Array) {
            CONUnsafe(`
// r1 = arr_ptr
set ri r1
set rc flat[ri]   // count
set r5 0
whilel r5 rc {
    set rd ri
    add rd 1
    set r4 r5
    mul r4 2
    add rd r4          // &arr[1+i*2]
    set r6 flat[rd]    // element type
    add rd 1
    set r7 flat[rd]    // element val
    ife r6 4 {         // String
        set r0 r7
        state free
    }
    ife r6 5 {         // Array (recurse)
        state pushr2
        set r0 r6
        set r1 r7
        state CJson__freeNode
        state popr2
    }
    ife r6 6 {         // Object (recurse)
        state pushr2
        set r0 r6
        set r1 r7
        state CJson__freeNode
        state popr2
    }
    add r5 1
}
set r0 r1
state free
`);
            return;
        }
        if (type == CJsonType.Object) {
            CONUnsafe(`
// r1 = obj_ptr
set ri r1
set rc flat[ri]
set r5 0
whilel r5 rc {
    set rd ri
    add rd 1
    set r4 r5
    mul r4 3
    add rd r4
    // Free key string
    set r6 flat[rd]
    set r0 r6
    state free
    add rd 1
    set r6 flat[rd]    // val type
    add rd 1
    set r7 flat[rd]    // val
    ife r6 4 {
        set r0 r7
        state free
    }
    ife r6 5 {
        state pushr2
        set r0 r6
        set r1 r7
        state CJson__freeNode
        state popr2
    }
    ife r6 6 {
        state pushr2
        set r0 r6
        set r1 r7
        state CJson__freeNode
        state popr2
    }
    add r5 1
}
set r0 r1
state free
`);
        }
    }
}
