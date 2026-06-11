# TypeCON Technical Architecture

This document explains the inner workings of the TypeCON compiler, how it manages memory, handles variables, and transpiles modern TypeScript constructs into the Build Engine's CON language.

---

## 1. Registers
TypeCON implements a virtual register machine on top of CON. All registers are declared as `gamevar` with flag `132096` (per-player/actor context where needed, though used mainly as globals).

### General-purpose and expression registers

| Register | Name | Purpose |
| :--- | :--- | :--- |
| `r0` – `r23` | General Purpose | Function parameters (`r0`–`r23`); inner loops and pre-compiled defstates also use `r4`–`r10` as scratch. |
| `ra` | Accumulator | Result of the last expression or operation. Every `CONUnsafe` epilogue does `set rb ra`, so `ra` must hold the intended return value at the end of any inline block. |
| `rb` | Base / Return | Function return values and heap allocation results (`state alloc` returns address in `rb`). |
| `rc` | Counter | Loop iteration counters and internal uses. |
| `rd` | Data | Scratch for binary operations; also used as a pointer offset accumulator. |
| `ri` | Index | `flat` array index — loaded before any `flat[ri]` access. |
| `rsi` | Source Index | Subfunction dispatch and native-array indexing. |

### Control-flow registers

| Register | Name | Purpose |
| :--- | :--- | :--- |
| `rsw` | Switch Value | Holds the switch expression value during two-pass switch execution. |
| `rswc` | Switch Counter | Tracks which pass of the two-pass switch is running. |
| `rswe` | Switch Enable | Enables or disables individual case clauses during the second pass. |
| `rf` | Flags | Bit-field of runtime state (e.g. bit 0 = heap address return mode). |

### Stack and frame registers

| Register | Name | Purpose |
| :--- | :--- | :--- |
| `rbp` | Base Pointer | Start of the current function's stack frame inside `flat[]`. |
| `rsp` | Stack Pointer | Top of the stack; initialized to `globalStaticSize - 1` so local frames start above the global segment. |
| `rbbp` | Block Base Pointer | Set to `rbp + 1` at entry to every `actor`/`useractor`/`onevent`/`appendevent` block. Used by the actor `break` epilogue to unwind the stack to the outermost frame (not just the innermost function frame). |
| `rds` | Segmentation | Initialized to `stackSize`; marks the boundary between the stack/global region and the heap. |

### String stack registers

| Register | Name | Purpose |
| :--- | :--- | :--- |
| `rsbp` | String Base Pointer | Base of the current quote-string stack frame (initialized to quote index 1024). |
| `rssp` | String Stack Pointer | Top of the quote-string stack (initialized to 1023; quotes 1022–1023 are scratch). |

### Fixed-point scratch registers

| Register | Name | Purpose |
| :--- | :--- | :--- |
| `rfx0` – `rfx3` | FP Scratch | Fast temporaries reserved for pre-compiled `defstate` modules (`_stringFuncs`, `_convertFP2String`, etc.). Compiler-generated code does not emit these; they exist to give the pre-compiled CON blocks stable scratch space that won't be clobbered by a surrounding `state` call. |

### Test counter

| Register | Name | Purpose |
| :--- | :--- | :--- |
| `_testCounter` | Test Counter | Initialized to `-1` (disabled). When `// debug-test` mode is active, `_testInit` sets it to `0`. Encoded as `(total_count << 12) \| pass_count`; decoded after simulation by `--test`. |

### Per-actor property pointer

| Register | Name | Purpose |
| :--- | :--- | :--- |
| `_pCptr` | Property Class Pointer | `GAMEVAR_PERACTOR` (flag `2`) — every sprite has its own slot. Holds the `flat[]` heap address of that actor's custom property block, or `0` if none. Accessed directly as `set ri _pCptr` inside actor code; scanned by the GC via `getactorvar[rc]._pCptr`. |

---

## 2. Flat Memory Model
TypeCON uses a single large array named `flat` to represent the entire accessible memory space. This mimics a real flat memory architecture.

### Address Space Layout:
1.  **Stack (Address `0` to `stackSize - 1`)**: Stores local variables, saved registers, and call frames.
2.  **Global Space (`stackSize` to `stackSize + globalSize - 1`)**: Reserved for global variables.
3.  **Heap (`stackSize + globalSize` and above)**: Dynamically allocated memory for objects and arrays.

The register `rds` (Segmentation) is initialized to point to the start of the heap.

### Heap Management
The compiler includes built-in `defstate` handlers for memory allocation:
- **`alloc`**: Takes size in `r0`, returns address in `rb`. It searches the `allocTable` for contiguous free pages.
- **`PAGE_SIZE` Logic**: Every allocation is rounded up to the nearest `PAGE_SIZE` (default 4 or 8). This reduces fragmentation and simplifies tracking.
- **Dynamic Growth**: If the heap is full, the framework calls `resizearray flat` to physically grow the memory available to the engine.
- **`free`**: Releases memory at address in `r0` by marking the corresponding index in `allocTable` as `0`.

---

## 3. String Management
TypeCON employs two parallel systems for handling strings: **Flat Strings** for logic/storage and **Quote Strings** for engine display.

### Flat Strings (Heap-Allocated)
Most TypeCON strings exist as regular objects within the `flat` memory array. They are heap-allocated during initialization or at runtime.

- **Storage Structure**:
  - `flat[ptr]`: Stores the **Length** of the string.
  - `flat[ptr + 1]` to `flat[ptr + length]`: Stores the actual characters as numeric ASCII codes.
- **Operations**: States like `_stringConcat` and `_convertInt2String` operate directly on these buffers.
- **Type Identifier**: In `allocTable`, strings are marked with type `2`.

### Quote Strings (The Engine Stack)
The Build Engine displays text via global "quotes" (indices 0-1023). TypeCON manages a subset of these as a stack to provide local scoping for display commands like `qputs` and `rotatesprite`.

- **Registers**: 
  - `rssp` tracks the current top quote index.
  - `rsbp` marks the bottom of the current string stack frame.
- **Conversion**:
  - When a display function (like `Native.printf`) is called, TypeCON automatically invokes `_convertString2Quote`. This state iterates through the **Flat String** buffer and copies its character values into the next available quote on the stack via logic using the `ASCII conversion table` (Quotes 900-994).
- **Temporary Buffer**: Quote `1023` is frequently used as a temporary scratchpad for formatting before a string is permanently pushed to the stack.

---

## 4. Garbage Collection
TypeCON implements a non-intrusive two-pass Mark-and-Sweep Garbage Collector via the `_GC` state.

1.  **Scan**: It iterates through all active heap pages in `allocTable`.
2.  **Mark (stack)**: It scans the **entire stack** (from `rbp` up to `rsp`) looking for any value that matches the heap address.
3.  **Mark (per-actor)**: For allocations of type `EHeapType.peractor` (bit 16), it additionally scans all live sprites via `for rc allsprites { getactorvar[rc]._pCptr ra }` to keep per-actor property blocks alive even when not on the stack.
4.  **Sweep**:
    - If a pointer is found on the stack **or** in an actor's `_pCptr`, it is considered "alive". Any "toBeFreed" mark (bit `1024`) is cleared.
    - If a pointer is NOT found:
        - If it was already marked with bit `1024`, it is physically freed (`allocTable = 0`).
        - Otherwise, it is marked with bit `1024` to be checked in the next cycle.
5.  **Lifecycle hook**: `appendevent EVENT_KILLIT` in the framework frees the `_pCptr` block automatically when any actor dies.

---

## 5. Variable Storage
### Local Variables
Local variables are stored directly on the stack. When a variable is declared:
1.  `rsp` is incremented (`add rsp 1`).
2.  The value (usually in `ra`) is stored at `flat[rsp]`.
3.  The compiler's symbol table tracks the variable's offset relative to `rbp`.

### Global Variables
Globals are stored in the reserved global section of the `flat` array. In "Module Mode", they are accessed via unique identifiers like `_G_ADDR_varName` which the linker later resolves to absolute indices.

---

## 6. Functions and Call Frames
Functions are transpiled into CON `defstate` blocks. Every function call follows a strict "prologue" and "epilogue" to maintain the stack.

### Function Structure:
```con
defstate MyFunction
  set ra rbp      // Save old base pointer
  state push      // Push it to stack (flat[rsp])
  set rbp rsp     // Set new base pointer to current stack top
  add rbp 1       // Frame starts after the saved RBP

  // ... Function Body ...

  sub rbp 1       // Back to saved RBP location
  set rsp rbp     // Clean up local variables from stack
  state pop       // Restore old base pointer into ra
  set rbp ra      // Restore RBP
ends
```

---

## 7. Control Flow
### Switch Statements
Since CON doesn't natively support complex fallthrough switches, TypeCON uses a unique "Two-Pass" jump trick:

1.  **Pass 1**: It captures the current code address using `getcurraddress ra` and proceeds to calculate which case matches.
2.  **Jump**: It jumps back to the start of the block with a flag set.
3.  **Pass 2**: On the second execution, the logic uses the pre-calculated match to "enable" specific clauses (`rswe` register), allowing fallthrough until a `break` (which is transpiled to a `jump` out of the block).

### Subfunctions (Anonymous Functions)
Anonymous functions are indexed in a global dispatcher.
- `rsi` is loaded with the shared context or the function ID.
- `state _subFunctions_<hash>` handles the jump table.

---

## 8. Objects, Arrays, and Actor Labels
### Core Representation
Objects and Arrays are identical at the memory level: they are pointers to a block in the `flat` array.
- **Arrays**: `flat[ptr]` stores the length, followed by elements.
- **Objects**: `flat[ptr + offset]` stores properties.

### Actions, AIs, and Moves
These are special Build Engine types. TypeCON treats them as both native labels and structured objects:
1.  **CON Labels**: Commands like `action A_DOG_WALK 0 4 5 1 20` are generated.
2.  **Memory Objects**: If configured, the compiler also creates a "shadow" object in the `flat` memory at global scope.
    - **`IAction`**: Stores `loc` (the label pointer), `start`, `length`, `viewType`, `incValue`, and `delay`.
    - **`IMove`**: Stores `loc`, `horizontal_vel`, and `vertical_vel`.
    - **`IAi`**: Stores `loc`, `action` pointer, `move` pointer, and `flags`.

This dual representation allows you to pass an `Action` as a variable in TypeScript while still having it compile down to native engine labels when needed.

---

## 9. Language Sets & Native Integration
TypeCON uses "Language Sets" (e.g., `TCSet100`) to define the available native environment. This is primarily managed via `native.ts`.

### Command Translation
The compiler maps TypeScript function calls to native CON commands using the `nativeFunctions` array in `native.ts`.
- **String Mapping**: Simple commands like `native.fall()` map directly to the string `"fall "`.
- **Complex Logic**: Functions like `Spawn` or `Shoot` use TypeScript arrow functions to generate dynamic CON code based on arguments and optional function blocks (e.g., initializing an actor's properties immediately after spawning).
- **Flags**: `CON_NATIVE_FLAGS` (e.g., `LABEL`, `VARIABLE`, `ACTOR`) tell the compiler how to resolve each argument before generating the CON instruction.

### Native Objects & Properties

TypeCON exposes ten engine struct arrays as global read/write objects.
Each maps directly to a CON `get/set<op>[ri].<field>` pair, with `ri` holding the index
set by the preceding `visitExpression` call on the array index.

| TS global | CON op | Interface | Description |
|---|---|---|---|
| `sprites[]` | `a` | `CActor` | All sprites/actors in the map |
| `sectors[]` | `sector` | `CSector` | All sectors (ceiling/floor as `ISectorBase`) |
| `walls[]` | `wall` | `CWall` | All walls |
| `players[]` | `p` | `CPlayer` | All player slots |
| `projectiles[]` | `projectile` | `IProjectile` | Per-tile projectile definitions |
| `tsprites[]` | `tspr` | `ITSprite` | Renderer draw list (current frame only) |
| `userdef[]` | `userdef` | `IUserDef` | Global game settings |
| `input[]` | `input` | `IInput` | Per-player raw input state |
| `tiledata[]` | `tiledata` | `ITileData` | Per-tile art metadata (read-only) |
| `paldata[]` | `paldata` | `IPalData` | Per-palette flags (read-only) |

Member access like `projectiles[i].vel` compiles to `getprojectile[ri].vel ra`.
Assignment like `projectiles[i].vel = 512` compiles to `setprojectile[ri].vel ra`.

All ten names are excluded from symbol-table lookup in `visitMemberExpression.ts` (line 24)
so they bypass the local-variable path and fall directly into the CON accessor switch.

#### Sub-object groupings

Many structs expose both flat properties and logical sub-objects that alias the same CON field.
Sub-objects are a TypeScript-side convenience — they compile identically to the flat version:

```
projectiles[i].audio.fire   → getprojectile[ri].isound ra
projectiles[i].iSound       → getprojectile[ri].isound ra   (same)

input[i].motion.forward     → getinput[ri].fvel ra
input[i].forwardVel         → getinput[ri].fvel ra           (same)

sprites[i].hitType.ceilingZ → geta[ri].htceilingz ra
sprites[i].hitInfo.wall     → geta[ri].htg_t 6 ra
```

Sub-objects are entries with `type: CON_NATIVE_FLAGS.OBJECT` in a `nativeVars_*` array and
an `object: CON_NATIVE_VAR[]` child array in `src/sets/TCSet100/native.ts`.
`visitMemberExpression` recurses into this child array on nested property access.

#### Naming convention

- **`C` prefix** = Class (can be `extend`ed by user code): `CActor`, `CEvent`, `CPlayer`, `CSector`, `CWall`
- **`I` prefix** = Interface (struct shape only, used as a type annotation): `ISectorBase`, `IProjectile`, `ITSprite`, `IUserDef`, `ITileData`, `IPalData`, `IInput`

---

## 10. Pre-compiled Modules
TypeCON supports reusable modules that are written in TypeScript but compiled into standard CON states stored in an `asm` or `generated` folder.
- **Workflow**: Shared logic (like `_spriteFuncs.ts`) is transpiled into `.con` files containing `defstate` blocks.
- **Linker Integration**: These pre-compiled `.con` files are appended to the main output, allowing the final project to call them as standard states without re-compiling the logic every time.

---

## 11. CFile (File Operations)
The `CFile` class provides an interface for interacting with the file system, optimized for the Build Engine's `readarrayfromfile` and `writearraytofile` commands.

- **Mechanism**:
  - **Buffer**: Uses a temporary `number[]` buffer in the `flat` memory to hold file data.
  - **rstack Implementation**: When reading, it uses the engine's `rstack` (array) as an intermediate buffer. It calls `readarrayfromfile rstack <path>` and then copies/transposes the data into the `flat` heap.
  - **CONUnsafe Usage**: `CFile` methods heavily use `CONUnsafe()` to inject raw, high-performance CON instructions directly into the transpiled stream, bypassing the TypeScript expression parser.
- **Modes**: Supports both **Binary** (raw 32-bit values) and **Text** (ASCII/Unicode character conversion) modes.

---

## 12. The DN3D Module
The `DN3D` module brings native Duke Nukem 3D constants and structures into the TypeScript environment.
- **ENames**: A massive enumeration mapping classic tile/sprite names (like `DUKECAR`, `PIGCOP`, `EGG`) to their internal engine IDs.
- **Native Constants**: Defines standard game values like `shrunkDoneCount` or `thawTime` as `CON_CONSTANT` types, allowing the compiler to treat them as literals during transpilation.
- **Native States**: It includes declarations for native engine states that can be called from TypeScript while being linked to the original game logic.

---

## 13. Fixed-Point Arithmetic

TypeCON maps four fixed-point numeric types to plain TypeScript `number` intersections.
The compiler detects the declared type at the call site and automatically emits
`mulscale`/`divscale` instead of `mul`/`div` so precision is preserved.

### Precision types

| Type | Scale | 1.0 = | Typical use |
|---|---|---|---|
| `FP11` | Q20.11 | 2048 | BUILD engine BAM angles (0–2047 = full circle) |
| `FP14` | Q17.14 | 16384 | Engine sin/cos return values (−1.0 … 1.0) |
| `FP16` | Q15.16 | 65536 | General fixed-point math, zoom, coordinates |
| `FP30` | Q1.30 | 1073741824 | Unit-range values requiring high precision |

These are branded intersection types (`number & { __brand }`) — they are plain integers
at runtime; the brand is erased and exists only for compile-time type checking.

### Automatic code generation

The compiler reads the declared variable type via `FP_ALIAS_BITS` in
`visitVariableDeclaration.ts` and propagates `fpBits` through every sub-expression:

| TypeScript | CON output |
|---|---|
| `let a: FP16 = b * c` (both FP16) | `mulscale rd rd rhs 16` |
| `let a: FP16 = b / c` (both FP16) | `divscale rd rd rhs 16` |
| `let a: FP16 = b * c` (b=FP16, c=int) | `mul rd rhs` (scale preserved) |
| `let a: number = b * c` (both int) | `mul rd rhs` |

Mixing precisions (e.g. `FP16 * FP11`) raises a compile-time error.

### Conversion helpers

```typescript
intToFP16(x)        // shift left 16 bits
fp16ToInt(x)        // shift right 16 bits
fp16Raw(x)          // return raw integer (no shift — for APIs expecting 16.16 pattern)
fp16ToString(x)     // "1.5000" format via _convertFP2String defstate
fp16FromString(s)   // parse "1.5000" back to FP16
// Same pattern: FP11, FP14, FP30
```

### Manual override

Use `mulscale(a, b, shift)` and `divscale(a, b, shift)` for manual cross-precision math
when the automatic path is insufficient.

### Explicit cast functions

`FP11(x)`, `FP14(x)`, `FP16(x)`, `FP30(x)` are compiler-recognised call expressions that
emit a precision-aware shift:

```typescript
let angle: FP11 = FP11(90);    // emits: shiftl ra 11  (int → FP11)
let v: FP16 = FP16(someInt);   // emits: shiftl ra 16  (int → FP16)
```

A cast from one FP type to another emits the appropriate `shiftr`/`shiftl` difference.

### Float literal auto-scaling

Float literals with a decimal point (e.g. `0.5`, `90.0`) are now scaled to the ambient
FP precision of the surrounding expression rather than being emitted as raw integers.
When no FP context is present, they default to FP16.

---

## 14. Native `Record<string, T>`

`Record<string, T>` is a compiler-native hash map backed by the `_recFuncs` pre-compiled
module (`src/sets/TCSet100/precompile/src/_recFuncs.ts`). It lives on the CON heap.

### Heap block layout

```
flat[ptr + 0]            = capacity  (power-of-2; default 16)
flat[ptr + 1]            = count     (live entries)
flat[ptr + 2 + i*2 + 0] = hash      (0 = empty slot; -1 = tombstone)
flat[ptr + 2 + i*2 + 1] = value
```

Collisions are resolved by linear probing with wrap-around.
The table auto-doubles (`_rec_resize`) when `count > capacity * 3 / 4`.

### Runtime defstates

| Defstate | Convention | Description |
|---|---|---|
| `_rec_alloc` | `r0`=capacity (0→16) → `rb`=ptr | Allocates a new hash-table block (`2 + capacity*2` words). |
| `_rec_hash` | `r0`=key_str_ptr → `rb`=hash | FNV-1a 32-bit hash of a heap string; 0 remapped to 1. |
| `_rec_get` | `r0`=hash, `r1`=rec_ptr → `rb`=val, `rc`=found | Linear-probe lookup; returns `rc=0` if not found. |
| `_rec_set` | `r0`=hash, `r1`=rec_ptr, `r2`=val | Insert or update; triggers resize at 75% load. |
| `_rec_del` | `r0`=hash, `r1`=rec_ptr | Tombstones the slot (`hash=-1`, val=0); decrements count. |
| `_rec_free` | `r0`=rec_ptr | Frees the block. |

### Compile-time behaviour

When the compiler sees `Record<string, T>` in a type annotation it:
1. Tags the symbol with `ESymbolType.record` and records `record_value_type` / `record_value_fpbits`.
2. Emits `state _rec_alloc` for the empty-literal initializer (`{}`).
3. **String-literal key** (`r["score"]`): computes FNV-1a **at compile time** and emits the
   integer hash constant directly — zero runtime hashing cost for literal keys.
4. **Runtime key** (variable or expression): emits `state _rec_hash` before the lookup or store.
5. **Chained access** (`r["a"]["b"]`): recursively emits all `_rec_get` calls in order.
6. **Write** (`r["k"] = v`): emits `state _rec_set` with the hash in `r0`, the record ptr in `r1`,
   and the value in `r2`.

### Usage

```typescript
let scores: Record<string, number> = {};    // → state _rec_alloc; set scores rb
scores["alice"] = 1000;                     // → set r0 <fnv("alice")>; set r1 scores; set r2 1000; state _rec_set
scores["bob"]   = 750;
let n: number   = scores["alice"];          // → set r0 <fnv("alice")>; set r1 scores; state _rec_get; set n rb

// Delete an entry
// (emit _rec_del manually via CONUnsafe, or let GC collect the whole block)

// Nested record (from JSON)
let data: Record<string, any> = JSON.parse(text).ToRecord();
let hp: number = data["hp"];
```

---

## 15. CJson — Recursive-Descent JSON Parser

`CJson` (`src/sets/TCSet100/CJson.ts`) is a full JSON parser written in TypeScript/TypeCON that runs entirely in the CON VM. It parses a heap-allocated string into a tree of typed nodes, each backed by a compact block in `flat[]`.

### Instance layout (heap object, 5 words)

| Offset | Field | Description |
|---|---|---|
| `+0` | `_src` | Pointer to the source heap string being parsed |
| `+1` | `_pos` | Current parse cursor (character index into `_src`) |
| `+2` | `_type` | `CJsonType` tag (see below) |
| `+3` | `_val` | Raw value — int, FP16 raw, heap-string ptr, or block ptr |
| `+4` | `_owned` | 1 = this instance owns its data (must call `Free()`); 0 = view |

### `CJsonType` enum

| Value | Name | `_val` meaning |
|---|---|---|
| `0` | `Null` | `0` |
| `1` | `Bool` | `0` or `1` |
| `2` | `Int` | raw 32-bit integer |
| `3` | `FP16` | fixed-point value (65536 = 1.0) |
| `4` | `String` | pointer to heap string |
| `5` | `Array` | pointer to array block |
| `6` | `Object` | pointer to object block |

### Array block layout

```
flat[arr + 0]           = element count N
flat[arr + 1 + i*2 + 0] = type  of element i  (CJsonType)
flat[arr + 1 + i*2 + 1] = value of element i
```

Initial allocation: `1 + 16*2 = 33` words.

### Object block layout

```
flat[obj + 0]           = key count N
flat[obj + 1 + i*3 + 0] = key string pointer
flat[obj + 1 + i*3 + 1] = value type  (CJsonType)
flat[obj + 1 + i*3 + 2] = value
```

Initial allocation: `1 + 16*3 = 49` words.

### Parser flow

`new CJson(text)` calls `_parseValue()` which dispatches on the first non-whitespace character:

| First char | Action |
|---|---|
| `{` | `_parseObject()` — allocates object block, loops over `"key": value` pairs |
| `[` | `_parseArray()` — allocates array block, loops over values |
| `"` | `_parseString()` — copies the slice into a fresh heap string |
| `t` / `f` | sets `_type=Bool`, advances `_pos` by 4 or 5 |
| `n` | sets `_type=Null`, advances 4 |
| `-` or `0-9` | `_parseNumber()` — integer or FP16 (via `_stringToFP16` for decimals) |

**Key invariant:** `_type` and `_val` on `this` are overwritten by recursive child parses.
The private `_parseArray` and `_parseObject` methods save `arrPtr`/`objPtr` to a local before
recursing, and restore `_type`/`_val` afterwards.

### Navigation API

| Method | Returns | Notes |
|---|---|---|
| `GetType()` | `CJsonType` | Tag of this node |
| `IsNull()` | `bool` | True if `_type == 0` |
| `GetBool()` | `bool` | Reads `_val != 0`; uses `CONUnsafe` to bypass TS bool restriction |
| `GetInt()` | `number` | Returns `_val`; auto-converts FP16 → int via `fp16ToInt` |
| `GetNumber()` | `FP16` | Returns `_val`; auto-converts int → FP16 via `intToFP16` |
| `GetString()` | `string` | Heap string pointer cast |
| `GetLength()` | `number` | Element count from array/object block header |
| `GetItem(i)` | `CJson` | View node for array element `i`; do **not** `Free()` it |
| `Find(key)` | `CJson` | FNV-1a key lookup on object block; returns `Null` node if missing; do **not** `Free()` it |
| `GetKey(i)` | `string` | Key string at object index `i` |
| `Stringify()` | `string` | Recursive serialisation back to compact JSON |
| `ToRecord()` | `Record<string, any>` | Converts an Object node to a native `Record`; recursively nests child objects |
| `Free()` | — | Recursively frees all owned heap blocks |

### `Find()` — key lookup detail

`Find(key)` hashes the query string with FNV-1a, restores `obj_ptr` from `this._val`,
then scans the object block entries, hashing each stored key in turn. When a hash matches
it reads the type and value and allocates a 5-word **view** block (`_owned=0`). Because
`ri` is clobbered by the inner per-entry hash loop, a stable copy of `obj_ptr` is kept in
`r10` for the outer loop.

### `ToRecord()` — stack balance requirement

The TypeCON compiler emits a single `sub rsp N` after an if-else to clean up all locals
declared in either branch. If the two branches allocate a different number of locals the
cleanup count is wrong and the stack pointer gets corrupted. `ToRecord()` calls `Find(k)`
**before** the `if (GetTypeAt(i) == Object)` branch so both branches see the same `child`
local on the stack — equal `N` in both, preserving the invariant.

### `JSON` alias

`src/sets/TCSet100/JSON.ts` exposes the standard JavaScript names:

```typescript
JSON.parse(text)        // → new CJson(text)
JSON.stringify(node)    // → node.Stringify()
```

---

## 16. `gameVar` Type

The `gameVar` type lets TypeCON source code declare native EDuke32 `GAMEVAR_PERACTOR` or
global gamevars that are accessible from the EDuke32 console and from CON code.

```typescript
const TCDEBUG_MODE: gameVar = 0;   // emits:  gamevar TCDEBUG_MODE 0 REG_FLAGS
```

**Compiler behaviour**

- Detected via the alias name `'gameVar'` in `visitVariableDeclaration.ts`.
- Emits `gamevar NAME VALUE REG_FLAGS` into `context.gameVarDeclarations[]`, which is
  prepended to the output before any `defstate` or event blocks (required by EDuke32's
  single-pass parser).
- The symbol is registered as `ESymbolType.native` with `CON_code: varName`.  
  Reads emit `set ra VARNAME`; writes emit `set VARNAME ra` — no `flat[]` indirection.
- Initial value can be overridden at build time via `--vars NAME=VALUE` (applied at emit
  time, so the substitution is baked into the `gamevar` declaration itself).

---

## 17. Per-Actor Custom Properties (`_pCptr`)

CActor and CPlayer subclasses can declare non-native instance properties. The compiler
allocates a per-actor heap block and points to it via the `_pCptr` `GAMEVAR_PERACTOR`.

### Supported property types

| TypeScript type | Storage | Block slots |
|---|---|---|
| `number` / `boolean` | Scalar value inline | 1 |
| Known interface/type | Inline object (all fields contiguous) | N (one per field) |
| `number[]` / `string[]` | Heap pointer (array allocated separately) | 1 |
| `string` | Heap pointer | 1 |

### Block layout

```
flat[_pCptr + 0]   = first property (or first field of first inline object)
flat[_pCptr + 1]   = second property / next inline field
...
flat[_pCptr + N-1] = last property
```

### Lifecycle

1. **Allocation** — `appendevent EVENT_SPAWN / ifactor PICNUM` runs `alloc(N, EHeapType.peractor)`
   and stores the result: `set _pCptr rb`. Default values from property declarations are
   then written, followed by any additional initialization from the constructor body.
2. **Access** — Inside actor methods, `set ri _pCptr` loads the base address into `ri`.
   Each property read/write then adds the property's compile-time offset: `add ri OFFSET;
   set ra flat[ri]` or `setarray flat[ri] VALUE`.
3. **GC** — The GC's allsprites scan (`for rc allsprites { getactorvar[rc]._pCptr ra }`)
   keeps per-actor blocks live as long as the actor sprite exists.
4. **Free** — `appendevent EVENT_KILLIT` in the framework checks `set ra _pCptr; ifn ra 0
   { state free; set _pCptr 0 }`, releasing the block when the actor is killed.

### Constructor body

Statements in the CActor/CPlayer constructor after `super()` are compiled into the
`EVENT_SPAWN` block, after the `_pCptr` allocation and default-value writes. This means
constructor code sees all custom properties already initialized.

```typescript
class Enemy extends CActor {
    constructor() {
        super(1234, true, 100);
        this.phase = 1;          // runs in EVENT_SPAWN after alloc
        this.target = -1;
    }
    public phase:  number = 0;
    public target: number = 0;
}
```

---

## 18. CON VM Simulator

The CON VM simulator (`src/modules/con-vm/`) is a full CON bytecode interpreter that can
run compiled `.con` output entirely within the TypeCON process — no EDuke32 binary needed.

### Module structure

| File | Role |
|---|---|
| `Parser.ts` | Tokenises and parses CON source into an AST/instruction list |
| `Interpreter.ts` | Executes instructions; manages registers, call stack, and game-struct state |
| `Memory.ts` | `flat[]` model with overflow detection, peak-water-mark tracking, and page-based heap accounting |
| `Tables.ts` | Build Engine tables: sintable (for `sin`/`cos`), `getangle` lookup |
| `Types.ts` | Shared types: `VMState`, `VMRunResult`, `StructField` maps |

### Supported opcodes (~55)

Arithmetic (`add`/`sub`/`mul`/`div`, `mulscale`/`divscale`), comparison (`ifvarand`,
`ifvarl`, …), array ops (`setarray`/`getarraysize`/`resizearray`), string ops
(`qputs`/`qstrcpy`/`qsprintf`/`qgetsysstr`), control flow (`while`, `switch…endswitch`,
`state`, `for VAR allsprites`), math (`sqrt`, `sin`/`cos`), file I/O
(`readarrayfromfile`/`writearraytofile`), and per-actor gamevars
(`getactorvar[I].FIELD DST`, `setactorvar[I].FIELD SRC`).

### Game struct support

`VMState` carries four struct-field maps — `actorFields`, `playerFields`, `sectorFields`,
`wallFields` — pre-seeded from the CLI and updated by `geta`/`seta`, `getp`/`setp`,
`getsector`/`setsector`, `getwall`/`setwall` instructions during execution.
`_pCptr` writes (`set _pCptr rb`) are automatically mirrored to `actorFields` so the GC
allsprites scan can find per-actor allocations during VM simulation.

### Actor test support

`// debug-test` now works on `CActor`/`CPlayer` `Main()` methods. The compiler emits
`//// DEBUG-TEST ////` + `state _testInit` immediately after the `useractor` line.
The VM fires `EVENT_SPAWN` before executing the actor body (so `_pCptr` is initialised),
and `testMode` auto-discovers debug-test actors when no `--actor` is specified.

### CLI flags

| Flag | Description |
|---|---|
| `--mem` | Print per-phase stack HWM and page-based heap accounting |
| `--test` | Aggregate `checkEq`/`checkFpEq` results; exit `0`/`1` |
| `--2-pass-gc` | Run GC twice after entry point — completes deferred deletion so the memory report shows "reclaimed" instead of "marked to free" |
| `--strict-int` | Throw on NaN or decimal values written to any CON variable/array |
| `--report FILE` | Write a JSON simulation report (memory, tests, variables, `actorFields`, and `flatMemory` with stack snapshot + heap page data) |

### JSON report structure (`--report`)

The `flatMemory` key in the JSON report contains:
- `stack` — `flat[0..peakRsp]`, the actually-used portion only
- `heapPages` — one entry per allocated page with `address`, `typeLabel` (human-readable), `sizeWords`, and `data[]`

This gives full memory visibility without requiring a profiling tool; any JSON viewer
or simple script can display or diff simulation state.

---

## 20. TCUI and TCDebug Libraries

Both are optional TypeScript libraries in `src/sets/TCSet100/`. Import when needed.

### TCUI (`TCUI.ts`)
`TCUI` is an ImGUI/Nuklear-style immediate-mode UI class. Call its methods every display
frame. Internal layout state lives in the class's own `flat[]` object fields — zero heap
allocation per frame.

```typescript
import './include/TCSet100/TCUI';
const ui = new TCUI();
ui.beginContainer(0, 0, 200, 100);
ui.setLayout(0, 0, 200, 10, 0);   // vertical, 10 px rows
ui.setFont(2930, 0, 8, 0, 0, ETextFlags.INTERNALSPACE);
ui.setStyle(-128, 0, EOrientationFlags.NOCLIP | EOrientationFlags.AUTO);
ui.text("Score: " + score);
ui.endContainer();
```

### TCDebug (`TCDebug.ts`)
`TCDebug` renders a two-line stack/heap overlay using TCUI. It self-hooks
`EVENT_DISPLAYEND` — importing the file activates it.

```typescript
import './include/TCSet100/TCDebug';
// setvar TCDEBUG_MODE 1   (from EDuke32 console)
// tcc make --vars TCDEBUG_MODE=1   (baked at build time)
```

---

## 21. Debug-Test Framework

The debug-test framework enables in-process unit testing of compiled CON output.

### How it works

1. A `// debug-test` comment on a `CEvent` `Append()` method, a plain `defstate`, or a
   `CActor`/`CPlayer` `Main()` method tells the compiler to enter test mode for that block.
2. The compiler emits a `//// DEBUG-TEST ////` CON marker, `state _testInit`, and
   `set rb _testCounter` at the start of the block.
3. Every `checkEq(a, b)` or `checkFpEq(a, b)` call site gets two injected lines:
   ```con
   add _testCounter 4096   ; increment total count (upper 12 bits)
   ife r1 r2
   add _testCounter 1      ; increment pass count (lower 12 bits)
   ```
4. After simulation the `--test` flag decodes `_testCounter` as
   `total = counter >> 12`, `passed = counter & 0xFFF` and prints per-function results.

### CLI integration

```bash
tcc -S compiled/EDUKE.CON --test
# [PASS] MyTest::Append   4/4
# [FAIL] MyMath::Test     2/3  (1 failure)
# Result: 6/7 passed
```

Exit code `0` means all tests passed; `1` means at least one failed.

---

## 22. `tcc test` Runner

The test runner module (`src/modules/test-runner/`) orchestrates the full
compile → link → simulate → assert pipeline from a single JSON script.

### Script schema

```json
{
  "source": "examples/tests/math/test_math.ts",
  "scenarios": [
    {
      "name": "basic math",
      "setup": {
        "actorFields": { "[0]extra": 42 }
      },
      "expect": [
        { "type": "eq", "target": "var",        "name":  "_testCounter", "value": 4096 },
        { "type": "eq", "target": "actorField", "index": 0, "field": "extra", "value": 42 }
      ],
      "defaultInclusion": false,
      "memTest": false,
      "validate": true
    }
  ]
}
```

### Assertion types

| `type` | Operators | `target` options |
|---|---|---|
| `eq` / `ne` | exact / not | `var`, `actorField`, `playerField`, `sectorField`, `wallField` |
| `gt` / `lt` / `ge` / `le` | numeric | same |

The runner exits `0` if all scenarios pass, `1` otherwise — making it compatible with
CI pipelines and `run-tests.sh` / `run-tests.bat`.
