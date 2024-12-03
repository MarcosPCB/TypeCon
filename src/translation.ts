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

gamearray stack `

export const initStates = `
defstate pushrall
    add rsp 1
    setarray stack[rsp] r0
    
    add rsp 1
    setarray stack[rsp] r1

    add rsp 1
    setarray stack[rsp] r2

    add rsp 1
    setarray stack[rsp] r3

    add rsp 1
    setarray stack[rsp] r4

    add rsp 1
    setarray stack[rsp] r5

    add rsp 1
    setarray stack[rsp] r6

    add rsp 1
    setarray stack[rsp] r7

    add rsp 1
    setarray stack[rsp] r8

    add rsp 1
    setarray stack[rsp] r9

    add rsp 1
    setarray stack[rsp] r10

    add rsp 1
    setarray stack[rsp] r11

    add rsp 1
    setarray stack[rsp] r12
ends

defstate poprall
    set r12 stack[rsp]
    sub rsp 1

    set r11 stack[rsp]
    sub rsp 1

    set r10 stack[rsp]
    sub rsp 1

    set r9 stack[rsp]
    sub rsp 1

    set r8 stack[rsp]
    sub rsp 1

    set r7 stack[rsp]
    sub rsp 1

    set r6 stack[rsp]
    sub rsp 1

    set r5 stack[rsp]
    sub rsp 1

    set r4 stack[rsp]
    sub rsp 1

    set r3 stack[rsp]
    sub rsp 1

    set r2 stack[rsp]
    sub rsp 1

    set r1 stack[rsp]
    sub rsp 1

    set r0 stack[rsp]
    sub rsp 1
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
    setarray stack[rsp] r0

    add rsp 1
    setarray stack[rsp] r1
ends

defstate popr2
    set r1 stack[rsp]
    sub rsp 1

    set r0 stack[rsp]
    sub rsp 1
ends

defstate pushr3
    add rsp 1
    setarray stack[rsp] r0

    add rsp 1
    setarray stack[rsp] r1

     add rsp 1
    setarray stack[rsp] r2
ends

defstate popr3
    set r2 stack[rsp]
    sub rsp 1

    set r1 stack[rsp]
    sub rsp 1

    set r0 stack[rsp]
    sub rsp 1
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