namespace noread {}

//Type for native functions
export type CON_NATIVE<Type> = Type;
export type CON_NATIVE_GAMEVAR<Type> = Type;

export class CON_NATIVE_POINTER { }

export enum CON_NATIVE_TYPE {
    native = 1,
    object = 2,
    array = 4,
    variable = 8
}

export enum CON_NATIVE_FLAGS {
    CONSTANT = 1,
    VARIABLE = 2,
    STRING = 4,
    LABEL = 8,
    OPTIONAL = 16,
    FUNCTION = 32,
    ACTOR = 64,
    PROJECTILE = 128,
    OBJECT = 256,
    ARRAY = 512,
    HEAP_POINTER = 1024
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

export enum EOperateFlags {
    doors = 1,
    activators = 2,
    master_switches = 4,
    respawns = 8,
    sectors = 16,
    all_activators_in_a_sector = 32
}

export interface CON_NATIVE_FUNCTION {
    name: string,
    code: string | ((args?: boolean, fn?: string) => string),
    returns: boolean,
    return_type: 'variable' | 'string' | 'pointer' | 'array' | 'object' | 'heap' | null,
    returnable?: any,
    return_size?: number,
    arguments: CON_NATIVE_FLAGS[],
    arguments_default?: any[]
    object_belong?: string[],
    type_belong?: string[]
}

export interface CON_NATIVE_VAR {
    name: string,
    var_type: CON_NATIVE_TYPE,
    type: CON_NATIVE_FLAGS,
    readonly: boolean,
    init: string | number,
    code: string | string[], //When override_code is true, code is an array containing the get and then the set code 
    object?: CON_NATIVE_VAR[],
    override_code?: boolean
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
        name: 'CanSeeTarget',
        code: `set rb 0 \nifcanseetarget set rb 1 \n`,
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
state pushd
geta[].htfloorz rd
sub rd sprite[].htceilingz
ifl ra rd {
add rb r3
seta[].yrepeat rb
}
state popd
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
                return `seta[].htg_t 0 r0 `;
            return `geta[].htg_t 0 rb `;
        }),
        returns: true,
        return_type: 'variable',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ]
    },
    {
        name: 'Fall',
        code: 'fall ',
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'BulletNear',
        code: 'set rb 0 \nifbulletnear set rb 1 ',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'HitByWeapon',
        code: 'set rb 0 \nifhitweapon set rb 1 ',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'WhichWeaponHit',
        code: 'set rb 0 \nife sprite[].htpicnum ra\n  set rb 1 ',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'Squished',
        code: 'set rb 0 \nifsquished set rb 1 ',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsItMoving',
        code: 'set rb 1 \nifnotmoving set rb 0 ',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsInWater',
        code: 'set rb 1 \nifinwater set rb 0 ',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsOnWater',
        code: 'set rb 1 \nifonwater set rb 0 ',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsOutside',
        code: 'set rb 1 \nifoutside set rb 0 ',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsInSpace',
        code: 'set rb 1 \nifinspace set rb 0 ',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsInOuterSpace',
        code: 'set rb 1 \nifinouterspace set rb 0 ',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'GetLastPal',
        code: 'getlastpal ',
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'PlayerKick',
        code: 'pkick ',
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'KillIt',
        code: 'killit ',
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'Glass',
        code: 'lotsofglass',
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.CONSTANT
        ]
    },
    {
        name: 'IsDead',
        code: 'set rb 0 \nifdead set rb 1 ',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'Stop',
        code: 'set rsp rbp \nstate pop \nset rbp ra \nreturn ',
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'ResetAction',
        code: 'resetactioncount ',
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'Flash',
        code: 'flash ',
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'RespawnHitag',
        code: 'respawnhitag',
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'Spawn',
        code: (args?: boolean, fn?: string) => {
            return `set rd RETURN \nifge r2 1 eqspawn r0 \nelse espawn r0 \n${fn}set rb RETURN \nset RETURN rd `;
        },
        returns: true,
        return_type: 'variable',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.FUNCTION | CON_NATIVE_FLAGS.OPTIONAL,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ],
        arguments_default: [0, 0, 0]
    },
    {
        name: 'Shoot',
        code: (args?: boolean, fn?: string) => {
            return `set rd RETURN \nife r2 0 eshoot r0 \nelse { \nife r4 1 { \neshoot r0 \ngeta[RETURN].zvel ra \nadd ra r3 \nseta[RETURN].zvel ra \n } else ezshoot r3 r0\n }\n${fn}set rb RETURN\nset RETURN rd `;
        },
        returns: true,
        return_type: 'variable',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.FUNCTION | CON_NATIVE_FLAGS.OPTIONAL,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ],
        arguments_default: [0, 0, 0, 0, 0]
    },
    {
        name: 'HitRadius',
        code: `hitradius`,
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
        ],
    },
    {
        name: 'Guts',
        code: `guts`,
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.CONSTANT,
            CON_NATIVE_FLAGS.CONSTANT
        ],
    },
    {
        name: 'Delete',
        code: (args?: boolean) => {
            return `state free \n`;
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
        ]
    },
    {
        name: 'Free',
        code: (args?: boolean) => {
            return `state free \n`;
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
        ]
    },
    {
        name: 'RotateSprite',
        code: `rotatesprite `,
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
        ]
    },
    {
        name: 'DrawSprite',
        returns: false,
        return_type: null,
        code: (args, fn) => {
            return `
state push
state pushb
state pushc

set ri r0
add ri 1

set r0 flat[ri]
add ri 1
set ra flat[ri]
add ri 1
set rc flat[ri]
add ri 1
set r1 flat[ri]

set ri r3
add ri 1

set r4 flat[ri]
add ri 1
set r3 flat[ri]
add ri 1
set rb flat[ri]


rotatesprite r0 ra rc r1 r2 r4 r3 rb 0 0 xdim ydim

state popc
state popb
state pop
`;
        },
        arguments: [
            CON_NATIVE_FLAGS.OBJECT,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.OBJECT
        ]
    },
    {
        name: 'ScreenText',
        code: `screentext `,
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
        ]
    },
    {
        name: 'log',
        code: 'echo',
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.STRING
        ],
        object_belong: ['console']
    },
    {
        name: 'debug',
        code: (args) => {
            return `
qputs 1022 DEBUG: %s
qsprintf 1023 1022 r0            
echo 1023
al r0            
`
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.STRING
        ],
        object_belong: ['console']
    },
    {
        name: 'error',
        code: (args) => {
            return `
qputs 1022 ERROR: %s
qsprintf 1023 1022 r0            
echo 1023
al r0            
`
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.STRING
        ],
        object_belong: ['console']
    },
    {
        name: 'IsPlayerState',
        code: `ifp`,
        returns: true,
        return_type: 'variable',
        arguments: [
            CON_NATIVE_FLAGS.CONSTANT
        ]
    },
    {
        name: 'DisplayQuote',
        code: `setp[].fta 99\nsetp[].ftq`,
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
        ]
    },
    {
        name: 'Pal',
        code: `ifn sprite[].picnum 1405\n  seta[].httempang sprite[].pal\nseta[].pal`,
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
        ]
    },
    {
        name: 'slice',
        returns: true,
        return_type: 'string',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ],
        arguments_default: [
            0, -1
        ],
        type_belong: ['string'],
        code: (args: boolean) => {
            return `
state push
state pushd
set ri r2
set ra flat[ri]

ifl r0 0
  set r0 0

ifl r1 0
  add ra r1
else ifle r1 ra
  set ra r1

set rd r0
sub ra rd
state pushr1
set r0 ra
add r0 1
state alloc
state popr1

setarray flat[rb] ra
add rb 1
add ri 1
add ri rd
copy flat[ri] flat[rb] ra
sub rb 1
state popd
state pop
`;
        }
    },
    {
        name: 'includes',
        return_type: 'variable',
        returns: true,
        arguments: [ CON_NATIVE_FLAGS.VARIABLE ],
        type_belong: [ 'string' ],
        code: (args) => {
            return `
state push
state pushd
state pushr3

set ra r0
set rb flat[ra]
add ra 1

set rd flat[r1]
set ri r1
add ri 1
add rd ri

set rc ri
set r2 0
whilel rc rd {
  ife flat[rc] flat[ra] {
    add ra 1
    add r2 1

    ife r2 rb
      exit
  } else {
    sub ra r2
    set r2 0 
  }

  add rc 1
}

ife r2 rb
  set rb 1
else set rb 0

state popr4
state popd
state pop
`
        }
    }
]


const nativePos: CON_NATIVE_VAR[] = [
    {
        name: 'x',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'x',
        init: 0
    },
    {
        name: 'y',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'y',
        init: 0
    },
    {
        name: 'z',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'z',
        init: 0
    },
];

export const nativeVars_Sprites: CON_NATIVE_VAR[] = [
    {
        name: 'curAction',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htg_t 4',
        init: 0,
    },
    {
        name: 'curMove',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htg_t 1',
        init: 0,
    },
    {
        name: 'curAI',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htg_t 5',
        init: 0,
    },
    {
        name: 'extra',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'extra',
        init: 0
    },
    {
        name: 'playerDist',
        var_type: CON_NATIVE_TYPE.variable,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: true,
        code: 'playerDist',
        init: 0
    },
    {
        name: 'damage',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htextra',
        init: -1
    },
    {
        name: 'htExtra',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htextra',
        init: -1
    },
    {
        name: 'weaponHit',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htpicnum',
        init: -1
    },
    {
        name: 'htPicnum',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htpicnum',
        init: -1
    },
    {
        name: 'curActionFrame',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htg_t 3',
        init: 0
    },
    {
        name: 'vel',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'xvel',
        init: 0
    },
    {
        name: 'ang',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'ang',
        init: 0
    },
    {
        name: 'picnum',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'picnum',
        init: 0
    },
    {
        name: 'pos',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: nativePos
    }
];

export const nativeVars_Walls: CON_NATIVE_VAR[] = [
    {
        name: 'pos',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: nativePos
    }
]

export const nativeVars_Sectors: CON_NATIVE_VAR[] = [
    {
        name: 'ceiling',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: true,
        init: 0,
        code: '',
        object: [
            {
                name: 'z',
                var_type: CON_NATIVE_TYPE.native,
                type: CON_NATIVE_FLAGS.VARIABLE,
                readonly: false,
                init: 0,
                code: `ceilingz`
            }
        ]
    },
    {
        name: 'extra',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'extra',
        init: 0
    },
    {
        name: 'walls',
        var_type: CON_NATIVE_TYPE.array,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: true,
        init: 0,
        code: ['getsector[ri].wallptr ra \nstate pushc \nset rc 0 \nwhilel rc rd { \ngetwall[ra].nextwall ra \nadd rc 1 \n} \nset ri ra \nstate popc \ngetwall[ri].', 'getsector[ri].wallptr ra \nstate pushc \nset rc 0 \nwhilel rc rd { \ngetwall[ra].nextwall ra \nadd rc 1 \n} \nset ri ra \nstate popc \nstate pop\nsetwall[ri].'],
        object: nativeVars_Walls,
        override_code: true,
    }
]

export const nativeVarsList = ['sprites', 'sectors', 'walls', 'projectiles',
    'players', 'tiledata', 'tsprites', 'paldata', 'userdef'];

export type pointer = void;

export function Label<pointer>(name: string): pointer {
    return name as pointer;
}

