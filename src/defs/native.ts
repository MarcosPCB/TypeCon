import { IActor } from "../types";
import { CON_NATIVE_POINTER } from "./types";

//Type for native functions
export type CON_NATIVE<Type> = Type;

export type CON_NATIVE_TYPE = 'global' | 'player' | 'actor';

export enum CON_NATIVE_FLAGS {
    CONSTANT,
    VARIABLE,
    STRING,
    LABEL,
    OPTIONAL
}

export interface CON_NATIVE_FUNCTION {
    name: string,
    code: string | (() => {}),
    returns: boolean,
    return_type: 'variable' | 'string' | 'pointer' | null,
    arguments: CON_NATIVE_FLAGS[]
}

export interface CON_NATIVE_VAR {
    name: string,
    object: string, //'none' if does belong to a object
    var_type: CON_NATIVE_TYPE,
    type: 'variable' | 'string' | 'pointer' | 'ts',
    readonly: boolean,
    code: string, //set and get
    init: string | number
}

export const nativeFunctions: CON_NATIVE_FUNCTION[] = [
    {
        name: 'PlayAction',
        code: `action`,
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.LABEL
        ]
    },
    {
        name: 'Move',
        code: `move`,
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.LABEL,
            CON_NATIVE_FLAGS.CONSTANT
        ]
    },
    {
        name: 'StartAI',
        code: `ai`,
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.LABEL
        ]
    },
    {
        name: 'PlayerDist',
        code: `findplayer rb`,
        returns: true,
        return_type: "variable",
        arguments: []
    }
]

export const nativeVars: CON_NATIVE_VAR[] = [
    {
        name: 'actions',
        object: 'this',
        var_type: 'actor',
        type: 'ts',
        readonly: false,
        code: '',
        init: 0,
    },
    {
        name: 'moves',
        object: 'this',
        var_type: 'actor',
        type: 'ts',
        readonly: false,
        code: '',
        init: 0,
    },
    {
        name: 'ais',
        object: 'this',
        var_type: 'actor',
        type: 'ts',
        readonly: false,
        code: '',
        init: 0,
    },
    {
        name: 'curAction',
        object: 'this',
        var_type: 'actor',
        type: 'pointer',
        readonly: false,
        code: 'htg_t 4',
        init: 0,
    },
    {
        name: 'curMove',
        object: 'this',
        var_type: 'actor',
        type: 'pointer',
        readonly: false,
        code: 'htg_t 1',
        init: 0,
    },
    {
        name: 'curAI',
        object: 'this',
        var_type: 'actor',
        type: 'pointer',
        readonly: false,
        code: 'htg_t 5',
        init: 0,
    },
    {
        name: 'extra',
        object: 'this',
        var_type: 'actor',
        type: 'variable',
        readonly: false,
        code: 'extra',
        init: 0
    }
]

export type pointer = void;

export function Label<pointer>(name: string): pointer {
    return name as pointer;
}


