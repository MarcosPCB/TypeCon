import { IActor } from "../types";

//Type for native functions
export type CON_NATIVE<Type> = Type;

export class CON_NATIVE_POINTER { }

export type CON_NATIVE_TYPE = 'global' | 'player' | 'actor' | 'var_player' | 'var_actor';

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
    arguments: CON_NATIVE_FLAGS[],
    arguments_default?: any[]
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
        returns: true,
        return_type: 'variable',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ]
    },
    {
        name: 'CStatOR',
        code: ((args?: boolean) => {
            return `geta[].cstat ra \norvar ra r0 \nseta[].cstat ra \n`;
        }),
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
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
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE
        ]
    },
    {
        name: 'SizeTo',
        code: ((arg?: boolean) => {
            return `geta[].xrepeat ra
geta[].yrepeat rb
ifl ra r0 {
add ra r2
seta[].xrepeat ra
}
ifl rb r1 {
set ra rb
gettiledata[sprite[].picnum].ysize rd
mul ra rd
add ra 8
shiftr ra 2
geta[].htfloorz rd
sub rd sprite[].htceilingz
ifl ra rd {
add rb r3
seta[].yrepeat rb
}
} \n`;
        }),
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ],
        arguments_default: [ 4, 4, 1, 1]
    },
    {
        name: 'Count',
        code: ((arg?: boolean) => {
            if(arg)
                return `seta[].htg_t 0 r0 \n`;
            return `geta[].htg_t 0 rb \n`;
        }),
        returns: true,
        return_type: 'variable',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ]
    },
    {
        name: 'Fall',
        code: 'fall \n',
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'BulletNear',
        code: 'set rb 0 \nifbulletnear set rb 1 \n',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'HitByWeapon',
        code: 'set rb 0 \nifhitweapon set rb 1 \n',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'Squished',
        code: 'set rb 0 \nifsquished set rb 1 \n',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsItMoving',
        code: 'set rb 1 \nifnotmoving set rb 0 \n',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'GetLastPal',
        code: 'getlastpal \n',
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'PlayerKick',
        code: 'pkick \n',
        returns: false,
        return_type: null,
        arguments: []
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
    },
    {
        name: 'playerDist',
        object: 'this',
        var_type: 'var_actor',
        type: 'variable',
        readonly: true,
        code: 'playerDist',
        init: 0
    },
    {
        name: 'damage',
        object: 'this',
        var_type: 'actor',
        type: 'variable',
        readonly: true,
        code: 'htextra',
        init: -1
    },
    {
        name: 'htExtra',
        object: 'this',
        var_type: 'actor',
        type: 'variable',
        readonly: true,
        code: 'htExtra',
        init: -1
    },
    {
        name: 'weaponHit',
        object: 'this',
        var_type: 'actor',
        type: 'variable',
        readonly: true,
        code: 'htPicnum',
        init: -1
    },
    {
        name: 'htPicnum',
        object: 'this',
        var_type: 'actor',
        type: 'variable',
        readonly: true,
        code: 'htPicnum',
        init: -1
    }
]

export type pointer = void;

export function Label<pointer>(name: string): pointer {
    return name as pointer;
}


