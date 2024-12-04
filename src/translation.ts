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

//Base pointer and Stack pointer
var rbp 0 0
var rsp -1 0

//Internal per-actor vars
var playerDist 0 2

array rstack 16 0

array stack `

export const initStates = `
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

`