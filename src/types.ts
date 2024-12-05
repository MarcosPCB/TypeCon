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
    NONE
}

export interface IBlock {
    type: EBlock;
    state: EState;
    name: string;
    locals?: 0;
    args?: 0;
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
    stack_object?: false,
    arg?: number
}

export type TVar = {
    type: string,
    value: string | number | boolean
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
}

export type TClassType = 'CActor' | 'IEvent';

export interface ILabel {
    label: string,
    pointer: any
}