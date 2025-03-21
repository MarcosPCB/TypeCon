import { CON_NATIVE_FLAGS } from '../../sets/TCSet100/native';

export enum EBlock {
    ACTOR,
    EVENT,
    BRANCH,
    FUNCTION,
    STATE,
    NONE
}

export enum EState {
    INIT,
    PARAMS,
    BODY,
    TERMINATED,
    NONE
}

export interface IBlock {
    type: EBlock;
    state: EState;
    name: string;
    locals?: 0;
    args: number;
    stack: number;
    base: number;
}

interface IArg {
    type: CON_NATIVE_FLAGS,
    name: string,
    variable: IVar
}

export type TObjectType = {
    name: string;
    type: 'string' | 'integer' | 'label' | 'object',
    array: boolean,
    object?: TObjectType[],
    size?: number
}

export interface IFunction {
    name: string,
    args: IArg[]
    returns: boolean,
    return_type: CON_NATIVE_FLAGS,
    object: 'this' | 'global'
}

export interface IVar {
    global: boolean,
    block: number,
    name: string,
    constant: boolean,
    type: 'integer' | 'string' | 'action' | 'move' | 'ai' | 'label' | 'any',
    typeRef?: IType,
    init: any,
    pointer: number,
    object_name?: string, //If object_name is _array, then it's an array
    object?: any, //If empty but object_name is defined, then it's the start of the object,
                  //otherwise it's an array of objects, holding all the possibilities
    static?: true,
    size?: number, //For objects and arrays
    arg?: number,
    heap: boolean,
    returned?: boolean //So the transpiler knows that the variable is a return value - works best with objects and arrays
}

export type TVar = {
    type: string,
    value: string | number | boolean
}

export interface IType {
    name: string,
    aliasTo: 'object' | 'number' | 'string',
    size: number,
    object?: TObjectType[]
}

export type TClassType = 'CActor' | 'CEvent';

export interface ILabel {
    label: string,
    pointer: any
}

export enum Names {
    APLAYER = 1405,
    BLOOD = 1620,
    FIRELASER = 1625,
    JIBS6 = 2286
}

export type TEventPAE = 'Game' | 'EGS' | 'Spawn' | 'KillIt' | 'PreGame' | 'PreActorDamage' | 'AnimateSprites' | 'RecogSound';
export type TEventDE = 'DisplayRest' | 'DisplayStart' | 'DisplayEnd';
export type TEvents = TEventPAE | TEventDE;

export const EventList: TEvents[] = [
    'DisplayRest',
    'DisplayStart',
    'DisplayEnd',
    'Game',
    'EGS',
    'Spawn',
    'AnimateSprites'
];