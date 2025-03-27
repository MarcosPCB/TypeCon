import { TranspilerContext } from "../services/Transpiler2";

export enum ECompileOptions {
    none = 0,
    no_read = 1,
    no_compile = 2,
    state_decl = 4
}

export interface ICompiledFile {
    path: string,
    code: string,
    declaration: boolean,
    context: TranspilerContext,
    options: ECompileOptions,
    dependents?: string[],
    dependency?: string[]
}

export const compiledFiles: Map<string, ICompiledFile> = new Map();

export class CONInit {
    public readonly heapSize: number;
    private initCode: string;
    private initStates: string;

    constructor(public readonly stackSize = 1024,
        public readonly heapPageSize = 8,
        public readonly heapNumPages = 64) {
            this.heapSize = heapNumPages * heapPageSize;

            let quoteInit = '';
            for(let i = 1023; i < stackSize + 1023; i++)
                quoteInit += `string ${i} reserved\n`; 

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
var r13 0 0
var r14 0 0
var r15 0 0
var r16 0 0
var r17 0 0
var r18 0 0
var r19 0 0
var r20 0 0
var r21 0 0
var r22 0 0
var r23 0 0

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
    16 - string address
*/
var rf 0 0

//Segmentation register
var rds ${stackSize} 0 //determines the start of the heap memory

//Base pointer and Stack pointer
var rbp 0 0
var rsp -1 0

//Base pointer ans Stack pointer fro string memory
define STRINGSTACK 1024 //This is where the stack begins - 1023 and 1022 are used as temporary holders for string operations
var rsbp 1024 0
var rssp 1023 0

//ASCII conversion table
string 900  
string 901 !
string 902 "
string 903 #
string 904 $
string 905 %
string 906 &
string 907 '
string 908 (
string 909 )
string 910 *
string 911 +
string 912 ,
string 913 -
string 914 .
string 915 /
string 916 0
string 917 1
string 918 2
string 919 3
string 920 4
string 921 5
string 922 6
string 923 7
string 924 8
string 925 9
string 926 :
string 927 ;
string 928 <
string 929 =
string 930 >
string 931 ?
string 932 @
string 933 A
string 934 B
string 935 C
string 936 D
string 937 E
string 938 F
string 939 G
string 940 H
string 941 I
string 942 J
string 943 K
string 944 L
string 945 M
string 946 N
string 947 O
string 948 P
string 949 Q
string 950 R
string 951 S
string 952 T
string 953 U
string 954 V
string 955 W
string 956 X
string 957 Y
string 958 Z
string 959 [
string 960 \
string 961 ]
string 962 ^
string 963 _
string 964 \`
string 965 a
string 966 b
string 967 c
string 968 d
string 969 e
string 970 f
string 971 g
string 972 h
string 973 i
string 974 j
string 975 k
string 976 l
string 977 m
string 978 n
string 979 o
string 980 p
string 981 q
string 982 r
string 983 s
string 984 t
string 985 u
string 986 v
string 987 w
string 988 x
string 989 y
string 990 z
string 991 {
string 992 |
string 993 }
string 994 ~


${quoteInit}

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
array rstack 24 0

//TypeCON flat memory (stack + heap)
array flat ${stackSize + this.heapSize}
`;
            this.initStates = `
state _convertString2Quote
    set ra r0
    add rssp 1

    //Get length
    set rb flat[ra]
    
    //Now we are in the text area
    add ra 1
    
    //Set ri to the first element of the ASCII conversion table
    set ri 900
    
    //Set rssp quote to the first letter of the string
    add ri flat[ra]
    sub ri 32
    qstrcpy rssp ri

    //rd serves as a flag for when there's a whitespace
    set rd 0

    set rc 1
    add ra 1
    whilel rc rb {
        set ri 900
        ife rd 1 {
            add ri flat[ra]
            sub ri 32
            qputs 1022 %s %s
            qsprintf 1023 1022 rssp ri
            qstrcpy rssp 1023
            add rc 1
            add ra 1
            set rd 0
            continue
        }

        ife flat[ra] 32 {
            set rd 1
            add rc 1
            add ra 1
            continue
        }

        add ri flat[ra]
        sub ri 32
        qstrcat rssp ri

        add rc 1
        add ra 1
        set rd 0
    }

    echo rssp

    set rb rssp
ends

var _HEAPi 0 0
var _HEAPj 0 0
var _HEAPk 0 0
var _HEAPl 0 0
var _HEAP_request 0 0
var _HEAP_pointer -1 0

defstate pushrall
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 r16 r17 r18 r19 r20 r21 r22 r23 
    copy rstack[0] flat[rsp] 24
    add rsp 23
ends

defstate poprall
    sub rsp 24
    copy flat[rsp] rstack[0] 24
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 r16 r17 r18 r19 r20 r21 r22 r23 
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

defstate pushr6
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5
    copy rstack[0] flat[rsp] 6
    add rsp 5
ends

defstate popr6
    sub rsp 6
    copy flat[rsp] rstack[0] 6
    getarrayseq rstack r0 r1 r2 r3 r4 r5
ends

defstate pushr7
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6
    copy rstack[0] flat[rsp] 7
    add rsp 6
ends

defstate popr7
    sub rsp 7
    copy flat[rsp] rstack[0] 7
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6
ends

defstate pushr8
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7
    copy rstack[0] flat[rsp] 8
    add rsp 7
ends

defstate popr8
    sub rsp 8
    copy flat[rsp] rstack[0] 8
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7
ends

defstate pushr9
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8
    copy rstack[0] flat[rsp] 9
    add rsp 8
ends

defstate popr9
    sub rsp 9
    copy flat[rsp] rstack[0] 9
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8
ends

defstate pushr10
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9
    copy rstack[0] flat[rsp] 10
    add rsp 9
ends

defstate popr10
    sub rsp 10
    copy flat[rsp] rstack[0] 10
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9
ends

defstate pushr11
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10
    copy rstack[0] flat[rsp] 11
    add rsp 10
ends

defstate popr11
    sub rsp 11
    copy flat[rsp] rstack[0] 11
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10
ends

defstate pushr12
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11
    copy rstack[0] flat[rsp] 12
    add rsp 11
ends

defstate popr12
    sub rsp 12
    copy flat[rsp] rstack[0] 12
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11
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