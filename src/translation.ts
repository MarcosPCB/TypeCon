type TParamType = 'variable' | 'string' | 'constant' | "label";

export interface IFuncTranslation {
    type: 'object' | 'function' | 'variable' | 'definition';
    tsObjName?: string;
    names?: boolean;
    tsName: string | string[];
    conName: string;
    params: TParamType[];
}

export const funcTranslator: IFuncTranslation[] = [
    {
        type: 'object',
        tsObjName: 'console',
        names: true,
        tsName: ['log', 'error'],
        conName: 'al',
        params: ['variable']
    }
];

export const initCode = `
//Used mainly for function parameters
var r0 0 0
var r1 0 0
var r2 0 0
var r3 0 0
var r4 0 0
var r5 0 0
var r6 0 0
var r7 0 0
var r8 0 0
var r9 0 0
var r10 0 0
var r11 0 0
var r12 0 0

//Accumulator
var ra 0 0

//Backup/return
var rb 0 0

//Counter
var rc 0 0

//Data
var rd 0 0

//Index
var ri 0 0

//Base pointer and Stack pointer
var rbp 0 0
var rsp -1 0

//Internal per-actor vars
var playerDist 0 2

define PAGE_SIZE 64

array rstack 16 0

//Heap blocks are sequential ALWAYS
array heap 512 0
array lookupHeap 8 0
var heapsize 512 0 //8 * PAGE_SIZE
var lookupheapsize 8 0

array stack `

export const initStates = `
var _HEAPi 0 0
var _HEAPj 0 0
var _HEAPk 0 0
var _HEAPl 0 0
var _HEAP_request 0 0
var _HEAP_pointer -1 0

defstate _GetFreePages
    set _HEAPi 0
    set _HEAPj 0
    set _HEAP_pointer -1
    for _HEAPi range heapsize {
        ife lookupHeap[_HEAPi] 0 {
            add _HEAPj 1
            ife _HEAPj _HEAP_request {
                set _HEAP_pointer _HEAPi
                sub _HEAP_pointer _HEAPj
                mul _HEAP_pointer PAGE_SIZE
                exit
            }
        } else ifn _HEAPj 0
            set _HEAPj 0
    }

    ife _HEAP_pointer -1 {
        set _HEAPi PAGE_SIZE
        mul _HEAPi _HEAP_request
        set _HEAP_pointer heapsize
        add heapsize _HEAPi
        add lookupheapsize _HEAP_request
        resizearray heap heapsize
        resizearray lookupHeap lookupheapsize
    }
ends

defstate alloc
    set _HEAP_request r0
    div _HEAP_request PAGE_SIZE
    ife _HEAP_request 0
        set _HEAP_request 1
    state GetFreePages

    set _HEAPi _HEAP_pointer
    div _HEAPi PAGE_SIZE
    set _HEAPj _HEAPi
    add _HEAP_request _HEAPi
    for _HEAPi range _HEAP_request {
        set _HEAPk _HEAPj
        add _HEAPk _HEAP_request
        shiftl _HEAPk 16
        or _HEAPk _HEAPi
        setarray lookupHeap[_HEAPi] _HEAPk
    }

    set rb _HEAP_pointer
ends

defstate realloc
    set _HEAP_request r0
    div _HEAP_request PAGE_SIZE
    ife _HEAP_request 0
        set _HEAP_request 1
    state GetFreePages

    set _HEAPi _HEAP_pointer
    div _HEAPi PAGE_SIZE
    set _HEAPj _HEAPi
    add _HEAP_request _HEAPi
    for _HEAPi range _HEAP_request {
        set _HEAPk _HEAPj
        add _HEAPk _HEAP_request
        shiftl _HEAPk 16
        or _HEAPk _HEAPi
        setarray lookupHeap[_HEAPi] _HEAPk
    }

    set rb _HEAP_pointer

    set _HEAP_pointer r1
    set _HEAPj _HEAP_pointer
    div _HEAPj PAGE_SIZE
    set _HEAPi _HEAPj
    set _HEAPk lookupHeap[_HEAPi]
    set _HEAPi _HEAPk
    and _HEAPi 0xFFFF
    shiftr _HEAPk 16
    mul _HEAPi PAGE_SIZE
    mul _HEAPk PAGE_SIZE
    sub _HEAPk _HEAPi
    copy heap _HEAPi heap rb _HEAPk
ends

defstate free
    set _HEAP_pointer r0
    set _HEAPj _HEAP_pointer
    div _HEAPj PAGE_SIZE
    set _HEAPi _HEAPj
    set _HEAPk lookupHeap[_HEAPi]
    set _HEAPi _HEAPk
    and _HEAPi 0xFFFF
    shiftr _HEAPk 16
    for _HEAPi range _HEAPk {
        setarray lookupHeap[_HEAPi] 0
    }
ends

defstate pushrall
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12
    copy rstack 0 stack rsp 13
    add rsp 12
ends

defstate poprall
    sub rsp 13
    copy stack rsp rstack 0 13
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12
ends

defstate pushr1
    add rsp 1
    setarray stack[rsp] r0
ends

defstate popr1
    set r0 stack[rsp]
    sub rsp 1
ends

defstate pushr2
    add rsp 1
    setarrayseq rstack r0 r1
    copy rstack 0 stack rsp 2
    add rsp 1
ends

defstate popr2
    sub rsp 2
    copy stack rsp rstack 0 2
    getarrayseq rstack r0 r1
ends

defstate pushr3
    add rsp 1
    setarrayseq rstack r0 r1 r2
    copy rstack 0 stack rsp 3
    add rsp 2
ends

defstate popr3
    sub rsp 3
    copy stack rsp rstack 0 3
    getarrayseq rstack r0 r1 r2
ends

defstate pushr4
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3
    copy rstack 0 stack rsp 4
    add rsp 3
ends

defstate popr4
    sub rsp 4
    copy stack rsp rstack 0 4
    getarrayseq rstack r0 r1 r2 r3
ends

defstate pushr5
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4
    copy rstack 0 stack rsp 5
    add rsp 4
ends

defstate popr5
    sub rsp 5
    copy stack rsp rstack 0 5
    getarrayseq rstack r0 r1 r2 r3 r4
ends

defstate push
    add rsp 1
    setarray stack[rsp] ra
ends

defstate pop
    set ra stack[rsp]
    sub rsp 1
ends

defstate pushb
    add rsp 1
    setarray stack[rsp] rb
ends

defstate popb
    set rb stack[rsp]
    sub rsp 1
ends

defstate pushc
    add rsp 1
    setarray stack[rsp] rc
ends

defstate popc
    set rc stack[rsp]
    sub rsp 1
ends

defstate pushd
    add rsp 1
    setarray stack[rsp] rd
ends

defstate popd
    set rd stack[rsp]
    sub rsp 1
ends

`