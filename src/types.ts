import * as T from '@babel/types';
import './defs/types';
import { CON_NATIVE_FLAGS } from './defs/native';

export interface IError {
    type: 'error' | 'warning';
    node: string;
    location: T.SourceLocation;
    message: string;
}

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
    size: number
}

export interface IActor {
    name: string,
    enemy: boolean,
    picnum: number,
    extra: number,
    first_action?: IAction,
    actions?: IAction[],
    moves?: IMove[],
    ais?: IAi[]
    export_name: string
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

export const EventList = [
    'DisplayRest',
    'DisplayStart',
    'DisplayEnd',
    'Game',
    'Egs'
];