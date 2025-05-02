import { Dirent, readdirSync, readFileSync } from "fs";
import { CompilerContext, indent } from "../services/Compiler";
import path from 'path';

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
    context: CompilerContext,
    options: ECompileOptions,
    dependents?: string[],
    dependency?: string[]
}

export const compiledFiles: Map<string, ICompiledFile> = new Map();

export let pageSize = 8;

export class CONInit {
    public readonly heapSize: number;
    private initCode: string;
    private initStates: string;

    constructor(public readonly stackSize = 1024,
        public readonly heapPageSize = 8,
        public readonly heapNumPages = 64,
        public readonly precompiled = true,
    ) {
            this.heapSize = heapNumPages * heapPageSize;
            pageSize = heapPageSize;

            let quoteInit = '';
            for(let i = 1023; i < stackSize + 1023; i++)
                quoteInit += `string ${i} reserved\n`; 

            this.initCode = `
//Used mainly for function parameters
define REG_FLAGS 132096
var r0 0 REG_FLAGS
var r1 0 REG_FLAGS
var r2 0 REG_FLAGS
var r3 0 REG_FLAGS
var r4 0 REG_FLAGS
var r5 0 REG_FLAGS
var r6 0 REG_FLAGS
var r7 0 REG_FLAGS
var r8 0 REG_FLAGS
var r9 0 REG_FLAGS
var r10 0 REG_FLAGS
var r11 0 REG_FLAGS
var r12 0 REG_FLAGS
var r13 0 REG_FLAGS
var r14 0 REG_FLAGS
var r15 0 REG_FLAGS
var r16 0 REG_FLAGS
var r17 0 REG_FLAGS
var r18 0 REG_FLAGS
var r19 0 REG_FLAGS
var r20 0 REG_FLAGS
var r21 0 REG_FLAGS
var r22 0 REG_FLAGS
var r23 0 REG_FLAGS

//Accumulator
var ra 0 REG_FLAGS

//Base/return
var rb 0 REG_FLAGS

//Counter
var rc 0 REG_FLAGS

//Data
var rd 0 REG_FLAGS

//Index
var ri 0 REG_FLAGS

//Source index
var rsi 0 REG_FLAGS

//Flags register
/*
    1 - heap address return
    2 - stack array return
    4 - stack object return
    8 - NULL return
    16 - string address
*/
var rf 0 REG_FLAGS

//Segmentation register
var rds ${stackSize} REG_FLAGS //determines the start of the heap memory

//Base pointer and Stack pointer
var rbp 0 REG_FLAGS
var rsp -1 REG_FLAGS

//Base pointer ans Stack pointer fro string memory
define STRINGSTACK 1024 //This is where the stack begins - 1023 and 1022 are used as temporary holders for string operations
var rsbp 1024 REG_FLAGS
var rssp 1023 REG_FLAGS

//ASCII conversion table
string 900  
string 901 !
string 902 "
//" - this comment stops some IDEs to fuck up the rest of the code analysis 
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
string 960 \\
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

//This is where we store if a page is free or not and its type
//0 -> free;
//1 -> regular array;
//2 -> string
//4 -> object
//1024 -> marked to be freed
array allocTable ${heapNumPages} 0

//Holds the starting addresses of the a allocated pages.
array lookupHeap ${heapNumPages} 0

//The current number of pages available
var heaptables ${heapNumPages} REG_FLAGS

//The current heap memory size
var heapsize ${this.heapSize} REG_FLAGS //heaptables * PAGE_SIZE

//For pushing the r0-12 registers
array rstack 24 0

//TypeCON flat memory (stack + heap)
array flat ${stackSize + this.heapSize}
`;
            this.initStates = `
var _HEAPi 0 REG_FLAGS
var _HEAPj 0 REG_FLAGS
var _HEAPk 0 REG_FLAGS
var _HEAPl 0 REG_FLAGS
var _HEAP_request 0 REG_FLAGS
var _HEAP_pointer -1 REG_FLAGS

defstate pushrall
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 r16 r17 r18 r19 r20 r21 r22 r23 
    copy rstack[0] flat[rsp] 24
    add rsp 23
ends

defstate poprall
    sub rsp 23
    copy flat[rsp] rstack[0] 24
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 r16 r17 r18 r19 r20 r21 r22 r23 
    sub rsp 1
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
    sub rsp 1
    copy flat[rsp] rstack[0] 2
    getarrayseq rstack r0 r1
    sub rsp 1
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
    sub rsp 3
    copy flat[rsp] rstack[0] 4
    getarrayseq rstack r0 r1 r2 r3
    sub rsp 1
ends

defstate pushr5
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4
    copy rstack[0] flat[rsp] 5
    add rsp 4
ends

defstate popr5
    sub rsp 4
    copy flat[rsp] rstack[0] 5
    getarrayseq rstack r0 r1 r2 r3 r4
    sub rsp 1
ends

defstate pushr6
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5
    copy rstack[0] flat[rsp] 6
    add rsp 5
ends

defstate popr6
    sub rsp 5
    copy flat[rsp] rstack[0] 6
    getarrayseq rstack r0 r1 r2 r3 r4 r5
    sub rsp 1
ends

defstate pushr7
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6
    copy rstack[0] flat[rsp] 7
    add rsp 6
ends

defstate popr7
    sub rsp 6
    copy flat[rsp] rstack[0] 7
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6
    sub rsp 1
ends

defstate pushr8
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7
    copy rstack[0] flat[rsp] 8
    add rsp 7
ends

defstate popr8
    sub rsp 7
    copy flat[rsp] rstack[0] 8
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7
    sub rsp 1
ends

defstate pushr9
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8
    copy rstack[0] flat[rsp] 9
    add rsp 8
ends

defstate popr9
    sub rsp 8
    copy flat[rsp] rstack[0] 9
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8
    sub rsp 1
ends

defstate pushr10
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9
    copy rstack[0] flat[rsp] 10
    add rsp 9
ends

defstate popr10
    sub rsp 9
    copy flat[rsp] rstack[0] 10
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9
    sub rsp 1
ends

defstate pushr11
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10
    copy rstack[0] flat[rsp] 11
    add rsp 10
ends

defstate popr11
    sub rsp 10
    copy flat[rsp] rstack[0] 11
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10
    sub rsp 1
ends

defstate pushr12
    add rsp 1
    setarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11
    copy rstack[0] flat[rsp] 12
    add rsp 11
ends

defstate popr12
    sub rsp 11
    copy flat[rsp] rstack[0] 12
    getarrayseq rstack r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11
    sub rsp 1
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

defstate pushi
    add rsp 1
    setarray flat[rsp] ri
ends

defstate popi
    set ri flat[rsp]
    sub rsp 1
ends

defstate _GetFreePages
    set _HEAPi 0
    set _HEAPj 0
    set _HEAP_pointer -1
    whilel _HEAPi heaptables {
        ife allocTable[_HEAPi] 0 {
            add _HEAPj PAGE_SIZE
            ifge _HEAPj _HEAP_request {
                set _HEAP_pointer _HEAPi
                div _HEAPj PAGE_SIZE
                sub _HEAP_pointer _HEAPj
                add _HEAP_pointer 1
                mul _HEAP_pointer PAGE_SIZE
                set _HEAP_request _HEAPj
                exit
            }
        } else set _HEAPj 0

        add _HEAPi 1
    }

    ife _HEAP_pointer -1 {
        //Get the exact size we need
        set _HEAPj _HEAP_request
        div _HEAPj PAGE_SIZE
        add _HEAPj 1
        set _HEAPi _HEAPj
        mul _HEAPj PAGE_SIZE
        
        set _HEAP_pointer heapsize
        add _HEAP_pointer ${stackSize}
        add heapsize _HEAPj
        add heapsize ${stackSize}
        resizearray flat heapsize
        sub heapsize ${stackSize}
        add heaptables _HEAPi
        resizearray lookupHeap heaptables
        resizearray allocTable heaptables
    }
ends

defstate alloc
    set _HEAP_request r0
    ife _HEAP_request 0
        set _HEAP_request 1
    state _GetFreePages

    set _HEAPi _HEAP_pointer
    add _HEAP_pointer ${stackSize}
    div _HEAPi PAGE_SIZE
    set _HEAPj _HEAP_request
    add _HEAPj _HEAPi
    whilel _HEAPi _HEAPj {
        setarray lookupHeap[_HEAPi] _HEAP_pointer
        setarray allocTable[_HEAPi] r1
        add _HEAPi 1
    }

    set rb _HEAP_pointer
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
    add _HEAP_pointer ${stackSize}
    set _HEAPi _HEAP_pointer
    sub _HEAPi ${stackSize}
    div _HEAPi PAGE_SIZE
    whilel _HEAPi heaptables {
        ife lookupHeap[_HEAPi] _HEAP_pointer {
            setarray lookupHeap[_HEAPi] 0
            setarray allocTable[_HEAPi] 0
        }

        add _HEAPi 1
    }
ends

defstate realloc
    set ra r1
    set r1 r2
    state alloc
    set r1 ra

    set _HEAPi r1
    sub _HEAPi ${stackSize}
    div _HEAPi PAGE_SIZE

    set _HEAPj 0
    whilel _HEAPi heaptables {
        ifn lookupHeap[_HEAPi] r1
            exit

        add _HEAPj 1
        add _HEAPi 1
    }

    mul _HEAPj PAGE_SIZE
    set _HEAPi r1

    copy flat[_HEAPi] flat[rb] _HEAPj

    set r0 r1
    state free
ends

defstate _GC
    set _HEAPi 0
    whilel _HEAPi heaptables {
        ife allocTable[_HEAPi] 0 {
            add _HEAPi 1
            continue
        }

        set _HEAP_pointer lookupHeap[_HEAPi]

        set _HEAPj rbp
        set _HEAPk 0
        whilel _HEAPj rsp {
            ife flat[_HEAPj] _HEAP_pointer {
                set _HEAPk 1
                exit
            }

            add _HEAPj 1
        }

        ife _HEAPk 0 {
            set _HEAPj _HEAPi
            add _HEAPj 1

            whilel _HEAPj heaptables {
                set _HEAPl 0
                ifand allocTable[_HEAPj] 1
                    set _HEAPl 1

                ifand allocTable[_HEAPj] 4
                    set _HEAPl 1

                ife _HEAPl 1 {
                    set _HEAPl lookupHeap[_HEAPj]
                    set ra _HEAPl
                    set rc 0

                    whilee lookupHeap[_HEAPj] ra {
                        ife flat[_HEAPl] _HEAP_pointer {
                            set _HEAPk 1
                            exit
                        }

                        ife rc PAGE_SIZE {
                            add _HEAPj 1
                            set rc 0
                            ifge _HEAPj heaptables
                                exit

                            set ra lookupHeap[_HEAPj]
                        } else
                            add rc 1

                        add _HEAPl 1
                    }
                }

                add _HEAPj 1
            }

            ife _HEAPk 1 {
                ifand allocTable[_HEAPi] 1024 {
                    set ra allocTable[_HEAPi]
                    and ra 1024
                    setarray allocTable[_HEAPi] ra

                    whilel _HEAPi heaptables {
                        ifn lookupHeap[_HEAPi] _HEAP_pointer
                            exit

                        setarray allocTable[_HEAPi] ra
                        add _HEAPi 1
                    }

                    add _HEAPi 1
                    continue
                }

                whilel _HEAPi heaptables {
                    ifn lookupHeap[_HEAPi] _HEAP_pointer
                        exit

                    add _HEAPi 1
                }

                add _HEAPi 1
                continue
            }

            ifand allocTable[_HEAPi] 1024 {
                setarray allocTable[_HEAPi] 0
                setarray lookupHeap[_HEAPi] 0
            } else {
                set ra allocTable[_HEAPi]
                or ra 1024
                setarray allocTable[_HEAPi] ra
            }
            
            add _HEAPi 1

            whilel _HEAPi heaptables {
                ifn lookupHeap[_HEAPi] _HEAP_pointer
                    exit

                ifand allocTable[_HEAPi] 1024 {
                    setarray allocTable[_HEAPi] 0
                    setarray lookupHeap[_HEAPi] 0
                } else {
                    set ra allocTable[_HEAPi]
                    or ra 1024
                    setarray allocTable[_HEAPi] ra
                }

                add _HEAPi 1
            }
        }

        add _HEAPi 1
    }
ends

defstate pow
    state pushc
    set rc 0
    whilel rc r1 {
        mul r0 r0
        add rc 1
    }
    state popc
    set rb r0
ends

defstate _stringConcat
    state push
    state pushd
    state pushc

    set ra flat[r0] //String 1 length
    set rd flat[r1] //String 2 length

    set rc ra
    add rc rd
    state pushr2
    set r1 r0
    set r0 rc
    add r0 1
    state realloc
    state popr2
    setarray flat[rb] rc
    set ri rb
    add ri ra
    add ri 1
    add r1 1

    copy flat[r1] flat[ri] rd

    state popc
    state popd
    state pop
ends

defstate _convertInt2String
    state push
    set ra r0

    ife ra 0 {
        state pushr1
        set r0 2
        state alloc
        state popr1
        setarray flat[rb] 1
        add rb 1
        setarray flat[rb] 48
        sub rb 1
        state pop
        terminate
    }

    state pushc
    state pushd
    set rc 0

    set rd 0
    ifl ra 0 {
        set rd 1 //Flag it as a negative number
        state pushd
        add rc 1
    }
    
    whilen ra 0 {
        set rd ra
        mod rd 10
        add rd 48 //48 = '0'
        state pushd
        add rc 1
        div ra 10
    }

    state pushr1
    set r0 rc
    add r0 1
    state alloc
    state popr1

    set ri rb
    setarray flat[ri] rc

    whilen rc 0 {
        add ri 1
        state popd
        setarray flat[ri] rd
        sub rc 1
    }

    state popd
    state popc
    state pop
    
ends

defstate _convertString2Quote
    state push
    state pushd
    state pushc

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
        ife ri 0
            exit

        sub ri 32
        ifl ri 900 {
            qputs 1022 ERROR: %d is not a valid ASCII character
            qsprintf 1023 1022 ri
            echo 1023
            al ri
            exit
        }
        qstrcat rssp ri

        add rc 1
        add ra 1
        set rd 0
    }

    set rb rssp

    state popc
    state popd
    state pop
ends

defstate _krand
    mul randomseed 1664525
    add randomseed 221297
    set rb randomseed
    abs rb
ends

defstate _PlayAction
    seta[].htg_t 2 0
    seta[].htg_t 3 0
    seta[].htg_t 4 r0
ends

defstate _Move
    seta[].hitag r1
    seta[].htg_t 1 r0
ends

defstate _StartAI
    set ri flat[r0]
    seta[].htg_t 5 flat[ri]
    add ri 1
    seta[].htg_t 4 flat[ri]
    add ri 1
    seta[].htg_t 1 flat[ri]
    add ri 1
    seta[].hitag flat[ri]
    seta[].htg_t 2 0
    seta[].htg_t 3 0
    set ra 32
    or ra 32768
    geta[].htflags rb
    and rb ra
    set ra 0
    ifn rb 0
    set ra 1
    set rb 0
    ifg sprite[].extra 0
        set rb 1
    or ra rb
    geta[].hitag rb
    and rb 8
    ifg ra 0
    ifn rb 0 {
        state krand
        and rb 2047
        seta[].ang rb
    }  
ends
`
        }

    GetPrecompiledCode() {
        let dir: Dirent[];
        try {
            dir = readdirSync(`./include/TCSet100/precompile/CON`, {
                withFileTypes: true
            });
        } catch(err) {
            console.log(`Include folder or pre-compiled folder not set yet`);
            console.log(`Rebuild the folder so the compilation can proceed`);
            return null
        }

        let code = '';

        for(const f of dir) {
            if(f.isFile() && f.name.endsWith('.con')) {
                try {
                    const module = readFileSync(path.join(f.parentPath, f.name));
                    code += module.toString();
                } catch(err) {
                    console.log(`Unable to read/open pre-compiled module ${path.join(f.parentPath, f.name)}`);
                    return null;
                }
            }
        }

        return code;
    }

    BuildFullCodeFile(code: string) {
        let preCompCode: string | null;
        if(this.precompiled)  {
            preCompCode = this.GetPrecompiledCode();

            if(!preCompCode) {
                console.log(`Failed to link pre-compiled code. Stopping...`);
                process.exit(1);
            }
        }
        return this.initCode + this.initStates + (this.precompiled ? preCompCode : '')  + code;
    }

    BuildInitFile() {
        let preCompCode: string | null;
        if(this.precompiled)  {
            preCompCode = this.GetPrecompiledCode();

            if(!preCompCode) {
                console.log(`Failed to link pre-compiled code. Stopping...`);
                process.exit(1);
            }
        }

        return this.initCode + this.initStates + (this.precompiled ? preCompCode : '');
    }
}