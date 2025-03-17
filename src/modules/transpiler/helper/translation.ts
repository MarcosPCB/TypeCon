export class CONInit {
    public readonly heapSize: number;
    private initCode: string;
    private initStates: string;

    constructor(public readonly stackSize = 1024,
        public readonly heapPageSize = 8,
        public readonly heapNumPages = 64) {
            this.heapSize = heapNumPages * heapPageSize;

            this.initCode = `
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

//Base/return
var rb 0 0

//Counter
var rc 0 0

//Data
var rd 0 0

//Index
var ri 0 0

//Flags register
/*
    1 - heap address return
    2 - stack array return
    4 - stack object return
    8 - NULL return
*/
var rf 0 0

//Segmentation register
var rds ${stackSize} 0 //determines the start of the heap memory

//Base pointer and Stack pointer
var rbp 0 0
var rsp -1 0

//Internal per-actor vars
var playerDist 0 2

/*
    Every time an user request an X amount of memory (arrays or objects), its value must fit inside a PAGE,
    if it's bigger than a PAGE, than allocate as many PAGES as necessary.
    The system is limited to allocating 4 GBs of memory.
    OBS: the first page must remain free (so NULL address can work properly)
*/

//Internal size of the heap pages - for every X entries, 1 page, this way we can optimize the free and allocation systems
define PAGE_SIZE ${heapPageSize}

//This is where we store if a page is free or not.
array allocTable ${heapNumPages} 0

//Holds the starting addresses of the a allocated pages.
array lookupHeap ${heapNumPages} 0

//The current number of pages available
var heaptables ${heapNumPages} 0

//The current heap memory size
var heapsize ${this.heapSize} 0 //heaptables * PAGE_SIZE

//For pushing the r0-12 registers
array rstack 16 0

//TypeCON flat memory (stack + heap)
array flat ${stackSize + this.heapSize}
`;
            this.initStates = `
var _HEAPi 0 0
var _HEAPj 0 0
var _HEAPk 0 0
var _HEAPl 0 0
var _HEAP_request 0 0
var _HEAP_pointer -1 0

defstate pushrall
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12
    copy rstack[0] flat[rsp] 13
    add rsp 12
ends

defstate poprall
    sub rsp 13
    copy flat[rsp] rstack[0] 13
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12
ends

defstate pushr1
    add rsp 1
    setarray flat[rsp] r0
ends

defstate popr1
    set r0 flat[rsp]
    sub rsp 1
ends

defstate pushr2
    add rsp 1
    setarrayseq rstack r0 r1
    copy rstack[0] flat[rsp] 2
    add rsp 1
ends

defstate popr2
    sub rsp 2
    copy flat[rsp] rstack[0] 2
    getarrayseq rstack r0 r1
ends

defstate pushr3
    add rsp 1
    setarrayseq rstack r0 r1 r2
    copy rstack[0] flat[rsp] 3
    add rsp 2
ends

defstate popr3
    sub rsp 3
    copy flat[rsp] rstack[0] 3
    getarrayseq rstack r0 r1 r2
ends

defstate pushr4
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3
    copy rstack[0] flat[rsp] 4
    add rsp 3
ends

defstate popr4
    sub rsp 4
    copy flat[rsp] rstack[0] 4
    getarrayseq rstack r0 r1 r2 r3
ends

defstate pushr5
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4
    copy rstack[0] flat[rsp] 5
    add rsp 4
ends

defstate popr5
    sub rsp 5
    copy flat[rsp] rstack[0] 5
    getarrayseq rstack r0 r1 r2 r3 r4
ends

defstate pushr12
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4
    copy rstack[0] flat[rsp] 5
    add rsp 4
ends

defstate popr12
    sub rsp 5
    copy flat[rsp] rstack[0] 5
    getarrayseq rstack r0 r1 r2 r3 r4
ends

defstate push
    add rsp 1
    setarray flat[rsp] ra
ends

defstate pop
    set ra flat[rsp]
    sub rsp 1
ends

defstate pushb
    add rsp 1
    setarray flat[rsp] rb
ends

defstate popb
    set rb flat[rsp]
    sub rsp 1
ends

defstate pushc
    add rsp 1
    setarray flat[rsp] rc
ends

defstate popc
    set rc flat[rsp]
    sub rsp 1
ends

defstate pushd
    add rsp 1
    setarray flat[rsp] rd
ends

defstate popd
    set rd flat[rsp]
    sub rsp 1
ends

defstate _GetFreePages
    set _HEAPi 1
    set _HEAPj 0
    set _HEAP_pointer -1
    for _HEAPi range heaptables {
        ife allocTable[_HEAPi] 0 {
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
        add heapsize ${stackSize}
        resizearray flat heapsize
        sub heapsize ${stackSize}
        resizearray lookupHeap heaptables
        resizearray allocTable heaptables
    }
ends

defstate alloc
    set _HEAP_request r0
    div _HEAP_request PAGE_SIZE
    ife _HEAP_request 0
        set _HEAP_request 1
    state _GetFreePages

    set _HEAPi _HEAP_pointer
    div _HEAPi PAGE_SIZE
    set _HEAPj _HEAPi
    add _HEAP_request _HEAPi
    for _HEAPi range _HEAP_request {
        //set _HEAPk _HEAPj
        //add _HEAPk _HEAP_request
        //shiftl _HEAPk 16
        //or _HEAPk _HEAPi
        //mul _HEAPk PAGE_SIZE
        setarray lookupHeap[_HEAPi] _HEAPj

        setarray allocTable[_HEAPi] 1
    }

    set rb _HEAP_pointer
    add rb ${stackSize}
ends

defstate free
    set _HEAP_pointer r0
    sub _HEAP_pointer ${stackSize}
    ifl _HEAP_pointer 0 {
        qputs 9999 ERROR: TRIED TO FREE MEMORY BELOW HEAP
        //We gotta break or crash or we might have a memory leakage
        debug 9999
        return
    }
    set _HEAPj _HEAP_pointer
    div _HEAPj PAGE_SIZE
    set _HEAPi _HEAPj
    //set _HEAPk lo[_HEAPi]
    //set _HEAPi _HEAPk
    //and _HEAPi 0xFFFF
    //shiftr _HEAPk 16
    for _HEAPi range heaptables {
        ife lookupHeap[_HEAPi] _HEAPj {
            setarray lookupHeap[_HEAPi] 0
            setarray allocTable[_HEAPi] 0
        }
    }
ends

defstate realloc
    set _HEAP_request r0
    div _HEAP_request PAGE_SIZE
    ife _HEAP_request 0
        set _HEAP_request 1
    state _GetFreePages

    set _HEAPi _HEAP_pointer
    div _HEAPi PAGE_SIZE
    set _HEAPj _HEAPi
    add _HEAP_request _HEAPi
    for _HEAPi range _HEAP_request {
        set _HEAPk _HEAPj
        //add _HEAPk _HEAP_request
        //shiftl _HEAPk 16
        //or _HEAPk _HEAPi
        mul _HEAPk PAGE_SIZE
        setarray lookupHeap[_HEAPi] _HEAPk

        setarray allocTable[_HEAPi] 1
    }

    set rb _HEAP_pointer
    add rb ${stackSize}

    set _HEAP_pointer r1
    set _HEAPi _HEAP_pointer
    //div _HEAPj PAGE_SIZE
    //set _HEAPi _HEAPj
    set _HEAPj _HEAP_request
    mul _HEAPj PAGE_SIZE
    sub _HEAPj _HEAPi
    //set _HEAPk lookupHeap[_HEAPi]
    //set _HEAPi _HEAPk
    //and _HEAPi 0xFFFF
    //shiftr _HEAPk 16
    //mul _HEAPi PAGE_SIZE
    //mul _HEAPk PAGE_SIZE
    //sub _HEAPk _HEAPi
    copy flat[_HEAPi] flat[rb] _HEAPj

    state free
ends

defstate _CheckAndFreePage
    state push
    state pushb
    state pushd
    set _HEAP_pointer r0
    set _HEAPj _HEAP_pointer
    div _HEAPj PAGE_SIZE
    set _HEAPi _HEAPj
    set _HEAPk lookupHeap[_HEAPi]
    set _HEAPi _HEAPk
    and _HEAPi 0xFFFF
    shiftr _HEAPk 16

    set _HEAPj 0
    set _HEAPl rsp
    add _HEAPl 1
    for _HEAPj range _HEAPl {
        ifle flat[_HEAPj] _HEAPi
            set rb 1

        ifge flat[_HEAPj] _HEAPk 
            set rd 1
        
        //Free the pages
        ifeither rd rb {
            set ra _HEAPi
            state push

            set ra _HEAPj
            state push

            set ra _HEAPk
            state push

            set ra _HEAPl
            state push

            state free

            state pop
            set _HEAPl ra

            state pop
            set _HEAPk ra

            state pop
            set _HEAPj ra

            state pop
            set _HEAPi ra

            exit
        }
    }

    state popd
    state popb
    state pop
ends
`
        }

    BuildFullCodeFile(code: string) {
        return this.initCode + this.initStates + code;
    }

    BuildInitFile() {
        return this.initCode + this.initStates;
    }
}