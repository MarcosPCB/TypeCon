import { IActor } from "../types";

//Type for native functions
export type CON_NATIVE<Type> = Type;

export class CON_NATIVE_POINTER { }

export type CON_NATIVE_TYPE = 'global' | 'player' | 'actor';

export enum CON_NATIVE_FLAGS {
    CONSTANT,
    VARIABLE,
    STRING,
    LABEL,
    OPTIONAL
}

export enum EMoveFlags {
    faceplayer = 1,	        //actor faces the player.	                                                                1
    geth = 2,	            //use horizontal velocity.	                                                                2
    getv = 4,	            //use vertical velocity.	                                                                4
    randomangle = 8,	    //actor will face random direction.	                                                        8
    faceplayerslow = 16,	//same as faceplayer, but done gradually.	                                                16
    spin = 32,	            //spin in a clockwise circle.	                                                            32
    faceplayersmart = 64,	//same as faceplayer, but with a slight "lead" on position.	                                64
    fleeenemy = 128,	    //actor faces away from the player.	                                                        128
    jumptoplayer = 257,	    //actor will move vertically and then fall as if jumping.	                                257*
    seekplayer = 512,	    //actor will try to find the best path to the nearest player.	                            512
    furthestdir = 1024,	    //actor faces the furthest distance from the closest player.                                1024
    dodgebullet	= 4096      //actor attempts to avoid all shots directed at him. The actor will not avoid GROWSPARK.    4096	
}

export interface CON_NATIVE_FUNCTION {
    name: string,
    code: string | ((args?: boolean) => string),
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
    },
    {
        name: 'CanSee',
        code: `set rb 0 \nifcansee set rb 1 \n`,
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'CanShootTarget',
        code: `set rb 0 \nifcanshoottarget set rb 1 \n`,
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'CStat',
        code: ((args?: boolean) => {
            if(typeof args !== 'undefined')
                return `seta[].cstat r0 \n`;

            return `geta[].cstat rb \n`
        }),
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ]
    },
    {
        name: 'CStatOR',
        code: ((args?: boolean) => {
            return `state push \ngeta[].cstat ra \norvar ra r0 \nseta[].cstat ra \nstate pop \n`;
        }),
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ]
    },
    {
        name: 'SizeAt',
        code: ((arg?: boolean) => {
            return `seta[].xrepeat r0 \nseta[].yrepeat r1 \n`;
        }),
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ]
    },
    {
        name: 'SizeTo',
        code: ((arg?: boolean) => {
            return `state push \nstate pushb \ngeta[].xrepeat ra \ngeta[].yrepeat rb \nifl ra r0 { \nadd ra 1 \nseta[].xrepeat ra \n} \nifl rb r1 { \nadd rb 1 \nseta[].yrepeat rb \n} \nstate popb \nstate pop \n`;
        }),
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ]
    },
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


