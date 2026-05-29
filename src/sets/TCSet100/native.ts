namespace noread { }

// Fixed-point numeric types (also declared globally in types.ts)
export type FP11 = number;
export type FP14 = number;
export type FP16 = number;
export type FP30 = number;

//Type for native functions
export type CON_NATIVE<Type> = Type;
export type CON_NATIVE_GAMEVAR<Code, Type> = Type;
export type CON_NATIVE_OBJECT<Type> = Type;
export type CON_NATIVE_STATE<Type> = Type;
export type CON_CONSTANT<Type> = Type;

/**
 * CON_FUNC_ALIAS allows you to use a function from a class or an object without having to define it locally.
 * In the next example, this will allow you to use QuoteDimension without having to be inside the CEvent class
 * Rememeber: the varaible won't have a symbol nor it will be compiled
 * IMPORTANT: the variable name MUST BE the same name as the function
 * 
 * @example const QuoteDimension: CON_ALIAS_FUNC<typeof CEvent.prototype.QuoteDimension> = CEvent.prototype.QuoteDimension;
 */
export type CON_FUNC_ALIAS<F extends (...args: any[]) => any> = (...args: Parameters<F>) => ReturnType<F>;
export type CON_PROPERTY_ALIAS<F extends any> = F;

export class CON_NATIVE_POINTER { }

export enum CON_NATIVE_TYPE {
    native = 1,
    object = 2,
    array = 4,
    variable = 8,
    variable_range = 16,
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
    dodgebullet = 4096      //actor attempts to avoid all shots directed at him. The actor will not avoid GROWSPARK.    4096	
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
    code?: string | ((args?: boolean, fn?: string) => string) | ((constants: string[]) => string),
    fp_aware_code?: (fpBits: number) => string,
    inherit_fp_bits?: boolean,
    returns: boolean,
    return_type: 'variable' | 'string' | 'pointer' | 'array' | 'object' | 'heap' | null,
    returns_fp_bits?: 11 | 14 | 16 | 30,
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
    init: string | number, //When variable_range is set in var_type, init takes the first variable part of the game var's name.
    code: string | string[], //When override_code is true, code is an array containing the get and then the set code 
    object?: CON_NATIVE_VAR[],
    override_code?: boolean
}

export const nativeFunctions: CON_NATIVE_FUNCTION[] = [
    {
        name: 'PlayAction',
        code: (args: boolean) => {
            return `state _PlayAction`;
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.OBJECT
        ]
    },
    {
        name: 'Move',
        code: (args: boolean) => {
            return `state _Move`;
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.OBJECT,
            CON_NATIVE_FLAGS.VARIABLE
        ]
    },
    {
        name: 'StartAI',
        code: (args: boolean) => {
            return `state _StartAI`
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.OBJECT
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
            if (args == true)
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
            return `state _SizeTo`;
        }),
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ],
        arguments_default: [4, 4, 1, 1]
    },
    {
        name: 'Count',
        code: ((args?: boolean) => {
            if (args == true)
                return `seta[].htg_t 0 r0`;
            return `geta[].htg_t 0 rb`;
        }),
        returns: true,
        return_type: 'variable',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ]
    },
    {
        name: 'ActionCount',
        code: ((args?: boolean) => {
            if (args == true)
                return `seta[].htg_t 2 r0`;
            return `geta[].htg_t 2 rb`;
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
        name: 'IsAwayFromWall',
        code: 'set rb 0 \nifawayfromwall set rb 1',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsRandom',
        code: (args: boolean) => {
            return `state _IsRandom\n`
        },
        returns: true,
        return_type: 'variable',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
        ]
    },
    {
        name: 'IsInWater',
        code: 'set rb 0\nifinwater set rb 1',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsOnWater',
        code: 'set rb 0\nifonwater set rb 1',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsOutside',
        code: 'set rb 0\nifoutside set rb 1',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsInSpace',
        code: 'set rb 0 \nifinspace set rb 1',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsInOuterSpace',
        code: 'set rb 0 \nifinouterspace set rb 1',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'IsRespawnActive',
        code: 'set rb 0 \nifrespawn set rb 1',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'EndOfGame',
        code: 'endofgame ',
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.CONSTANT
        ]
    },
    {
        name: 'PalFrom',
        code: (args: boolean) => {
            return `
setp[].pals 0 r0
setp[].pals 1 r1
setp[].pals 2 r2
setp[].pals_time r3
`
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE
        ],
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
        name: 'AddKills',
        code: 'addkills',
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.CONSTANT
        ]
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
        code: `set rbp rbbp\nsub rbp 1\nset rsp rbp\nset rssp rsbp\nstate pop\nset rsbp ra\nstate pop\nset rbp ra\nstate _GC\nbreak`,
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'ResetAction',
        code: 'resetactioncount',
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'Flash',
        code: 'flash',
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
            if (args == true)
                return `
set rd RETURN
ifge r2 1
  eqspawn r0
else
  espawn r0
set r0 RETURN
set ra RETURN
${fn != '' ? `
state push
state pushd
${fn}
state popd
state pop
` : ''}
set rb ra
set RETURN rd`
            else return `
set rd RETURN
espawn r0
set rb RETURN
set RETURN rd`;
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
        name: 'Sound',
        returns: false,
        return_type: null,
        code: (args: boolean) => {
            return args == true ? `
ife r2 1
  soundonce r0
else ife r1 1
  globalsound r0
else
  sound r0` : 'sound r0'
        },
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ],
        arguments_default: [
            0, 0, 0
        ]
    },
    {
        name: 'StopSound',
        returns: false,
        code: `stopsound`,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
        ]
    },
    {
        name: 'Operate',
        code: (args: boolean) => {
            return `state _Operate`
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL,
        ],
        arguments_default: [
            0, 0, 0, 0, 0
        ]
    },
    {
        name: 'Shoot',
        code: (args?: boolean, fn?: string) => {
            return args == true ? `
set rd RETURN
ife r2 0
  eshoot r0
else {
  ife r4 1 {
    eshoot r0
    geta[RETURN].zvel ra
    add ra r3
    seta[RETURN].zvel ra
  } else
   ezshoot r3 r0
}
set r0 RETURN
set ra RETURN
${fn != '' ? `
state push
state pushd
${fn}
state popd
state pop
` : ''}
set rb ra
set RETURN rd`
                : `
set rd RETURN
eshoot r0
set rb RETURN
set RETURN rd`;
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
        name: 'Debris',
        code: `debris`,
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
        // Full-precision variant: x/y/scale as FP16, ang as FP11.
        // Auto-sets ROTATESPRITE_FULL16 (2048) in orientation.
        name: 'RotateSpriteF',
        code: (_a?: boolean) => `mul r0 320\nmul r1 200\nshiftr r3 11\nor r7 2048\nrotatesprite r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11`,
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE, // x: FP16
            CON_NATIVE_FLAGS.VARIABLE, // y: FP16
            CON_NATIVE_FLAGS.VARIABLE, // scale: FP16
            CON_NATIVE_FLAGS.VARIABLE, // ang: FP11 (stripped to raw BAM)
            CON_NATIVE_FLAGS.VARIABLE, // picnum
            CON_NATIVE_FLAGS.VARIABLE, // shade
            CON_NATIVE_FLAGS.VARIABLE, // pal
            CON_NATIVE_FLAGS.VARIABLE, // orientation (ROTATESPRITE_FULL16 auto-set)
            CON_NATIVE_FLAGS.VARIABLE, // x0
            CON_NATIVE_FLAGS.VARIABLE, // y0
            CON_NATIVE_FLAGS.VARIABLE, // x1
            CON_NATIVE_FLAGS.VARIABLE, // y1
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
        // Full-precision variant: x/y/scale as FP16, block_ang/character_ang as FP11.
        // Auto-sets ROTATESPRITE_FULL16 (2048) in orientation.
        name: 'ScreenTextF',
        code: (_a?: boolean) => `mul r1 320\nmul r2 200\nshiftr r4 11\nshiftr r5 11\nor r9 2048\nscreentext r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 r16 r17 r18 r19`,
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE, // picnum
            CON_NATIVE_FLAGS.VARIABLE, // x: FP16
            CON_NATIVE_FLAGS.VARIABLE, // y: FP16
            CON_NATIVE_FLAGS.VARIABLE, // scale: FP16
            CON_NATIVE_FLAGS.VARIABLE, // block_ang: FP11 (stripped to raw BAM)
            CON_NATIVE_FLAGS.VARIABLE, // character_ang: FP11 (stripped to raw BAM)
            CON_NATIVE_FLAGS.VARIABLE, // quote
            CON_NATIVE_FLAGS.VARIABLE, // shade
            CON_NATIVE_FLAGS.VARIABLE, // pal
            CON_NATIVE_FLAGS.VARIABLE, // orientation (ROTATESPRITE_FULL16 auto-set)
            CON_NATIVE_FLAGS.VARIABLE, // alpha
            CON_NATIVE_FLAGS.VARIABLE, // xspace
            CON_NATIVE_FLAGS.VARIABLE, // yline
            CON_NATIVE_FLAGS.VARIABLE, // xbetween
            CON_NATIVE_FLAGS.VARIABLE, // ybetween
            CON_NATIVE_FLAGS.VARIABLE, // flags
            CON_NATIVE_FLAGS.VARIABLE, // x0
            CON_NATIVE_FLAGS.VARIABLE, // y0
            CON_NATIVE_FLAGS.VARIABLE, // x1
            CON_NATIVE_FLAGS.VARIABLE, // y1
        ]
    },
    {
        name: 'QuoteDimension',
        code: (args: boolean) => {
            return `
state push
state pushd
qstrdim ra rd r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 r11 r12 r13 r14 r15 r16 r17 r18
add rsp 1
setarray flat[rsp] ra
add rsp 1
setarray flat[rsp] rd
set rb rsp
sub rb 3
`
        },
        returns: true,
        return_type: 'object',
        return_size: 2,
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
        name: 'PrintStackAndBreak',
        returns: false,
        return_type: null,
        arguments: [],
        code: (args) => {
            return `
qputs 1022 STARTING STACK AND HEAP DUMP
echo 1022
set ra 0
qputs 1022 BASE STACK ADDR:
echo 1022
al rbp
qputs 1022 STACK POINTER ADDR:
echo 1022
al rsp
set ri rsp
add ri 1
getarraysize flat rd
for ra range ri {
    ifge ra rd
        exit
    al flat[ra]
}

mul ri 4
qputs 1022 USED STACK: %d bytes
qsprintf 1023 1022 ri
echo 1023

set ra 0
set rd 0
qputs 1022 MAX. OF HEAP PAGES
echo 1022
al heaptables
qputs 1022 PAGE SIZE:
echo 1022
al PAGE_SIZE
whilel ra heaptables {
    ifn allocTable[ra] 0 {
        al allocTable[ra]
        al lookupHeap[ra]
        al pageSizes[ra]
        add rd pageSizes[ra]
    }

    add ra 1
}

mul rd 4
qputs 1022 USED HEAP: %d bytes
qsprintf 1023 1022 rd
echo 1023
    
debug 0
`}
    },
    {
        name: 'PrintValue',
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
        ],
        code: (args) => {
            return `al r0`
        }
    },
    {
        name: 'IsPlayerState',
        code: (constants: string[]) => {
            return `set rb 0\nifp ${constants[0]} set rb 1`;
        },
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
        arguments: [CON_NATIVE_FLAGS.VARIABLE],
        type_belong: ['string'],
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

state popr3
state popd
state pop
`
        }
    },
    {
        name: 'split',
        code: (args) => {
            return `
state push
state pushc
state pushd

set rd flat[r4] //String length
set ri r4
add ri 1

set rb flat[r0] //Separator length
add r0 1

set r2 0
set ra 0
set rc 0
set r3 rb

whilel rc rd {
  add ra 1
  state push
  sub rd 1

  set ra 0
  ife rc rd
    set ra 1

  add rd 1
  state pushd
  set rd 0

  state pushb

  set rb 0
  ife flat[ri] flat[r0] 
    set rb 1

  ifeither ra rb
    set rd 1

  state popb

  ife rd 1 {
    state popd
    state pop
    sub rb 1
    add r0 1
    sub ra 1
    sub rd 1
    ife rc rd
    ifn flat[ri] flat[r0] {
      add ri 1
      add ra 1
    }
    add rd 1
    ife rb 0 {
      sub r1 1

      state pushr1
      set r0 ra
      add r0 1
      state alloc
      setarray flat[rb] ra
      add rb 1
      set r0 ri
      sub r0 ra
      copy flat[r0] flat[rb] ra
      sub rb 1
      state popr1
      state pushb

      add r2 1
      sub r0 r3
      set rb r3
      set ra 0

      ife r1 0
        exit
    }
  } else ifn rb r3 {
   state popd
   state pop
   sub r0 r3
   set rb r3
   set ra 0
  } else {
    state popd
    state pop
  }

  add rc 1
  add ri 1
}

add r2 1
state pushr1
set r0 r2
state alloc
state popr1
sub r2 1
setarray flat[rb] r2
add rb 1
sub rsp r2
add rsp 1
copy flat[rsp] flat[rb] r2
sub rsp 1
sub rb 1

state popd
state popc
state pop
`
        },
        returns: true,
        return_type: 'array',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL,
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL, //internal use
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL //internal use
        ],
        arguments_default: [
            0, -1, 0
        ],
        type_belong: ['string']
    },
    {
        name: 'forEach',
        code: (args?: boolean, fn?: string) => {
            return `
set rd flat[r1]
set rc 0
for rc range rd {
  set rsi r1
  add rsi 1
  add rsi rc
  state pushr2
  set r0 flat[rsi]
  set r1 rc
  state pushc
  state pushd
  ${fn} 
  state popd
  state popc
  state popr2
}
state popr1
`
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.FUNCTION
        ],
        type_belong: ['array']
    },
    {
        name: 'push',
        type_belong: ['array'],
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
        ],
        returns: false,
        return_type: null,
        code: (args?: boolean, fn?: string) => {
            return `
state push
state pushd
state pushr3

set ra r1
set r0 flat[ra] //Array length
add r0 2
set rd r0
set r2 1

state realloc
state popr3

sub rd 1
setarray flat[rb] rd
setarray flat[r2] rb

sub rd 1
add rb 1
add rb rd
setarray flat[rb] r0

state popd
state pop
`
        }
    },
    {
        name: 'pop',
        type_belong: ['array'],
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
        ],
        returns: false,
        return_type: null,
        code: (args?: boolean, fn?: string) => {
            return `
state push
state pushd
state pushr3

set ra r1
set r0 flat[ra] //Array length
set rd r0
set r2 1

state realloc
state popr3

sub rd 1
setarray flat[rb] rd
setarray flat[r2] rb

sub rd 1
add rb 1
add rb rd
setarray flat[rb] r0

state popd
state pop
`
        }
    },
    {
        name: 'GetReference',
        code: (args: boolean) => {
            return `set rb r0\n`;
        },
        returns: true,
        return_type: 'array',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
        ],
        object_belong: ['sysFrame']
    },
    {
        name: 'BufferToIndex',
        code: (args: boolean) => {
            return `set ri r0\nife r1 1\n  add ri 1\n`;
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE
        ],
        object_belong: ['sysFrame']
    },
    {
        name: 'BufferToSourceIndex',
        code: (args: boolean) => {
            return `set rsi r0\nife r1 1\n  add rsi 1\n`;
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE
        ],
        object_belong: ['sysFrame']
    },
    {
        name: 'CONBreak',
        code: 'debug',
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.CONSTANT
        ]
    },
    {
        name: 'MemCopy',
        code: (args: boolean) => {
            return `copy flat[r0] flat[r1] r2\n`
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE,
            CON_NATIVE_FLAGS.VARIABLE
        ]
    },
    {
        name: 'CeilingDist',
        code: 'state _CeilingDist',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'FloorDist',
        code: 'state _FloorDist',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'GapDist',
        code: 'state _GapDist',
        returns: true,
        return_type: 'variable',
        arguments: []
    },
    {
        name: 'AmmoDiscount',
        code: (args?: boolean) => {
            if (args !== undefined)
                return `
setarray nwsAmmoDisc[flat[rbp]] r0
set rb r0`
            else return `
set rb nwsAmmoDisc[flat[rbp]]`
        },
        returns: true,
        return_type: 'variable',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ]
    },
    {
        name: 'MaxAmmo',
        code: (args?: boolean) => {
            if (args !== undefined)
                return `
setarray nwsMaxAmmo[flat[rbp]] r0
set rb r0`
            else return `
set rb nwsMaxAmmo[flat[rbp]]`
        },
        returns: true,
        return_type: 'variable',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ]
    },
    {
        name: 'CurrentAmmo',
        code: (args?: boolean) => {
            if (args !== undefined)
                return `
setarray nwsCurrAmmo[flat[rbp]] r0
set rb r0`
            else return `
set rb nwsCurrAmmo[rb]`
        },
        returns: true,
        return_type: 'variable',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE | CON_NATIVE_FLAGS.OPTIONAL
        ]
    },
    {
        name: 'DecreaseAmmo',
        code: (args?: boolean) => {
            return `
set ra nwsCurrAmmo[flat[rbp]]
sub ra nwsAmmoDisc[flat[rbp]]
clamp ra 0 nwsMaxAmmo[flat[rbp]]
setarray nwsCurrAmmo[flat[rbp]] ra`;
        },
        returns: false,
        return_type: null,
        arguments: []
    },
    {
        name: 'IncreaseAmmo',
        code: (args?: boolean) => {
            return `
set ra nwsCurrAmmo[flat[rbp]]
add ra r0
clamp ra 0 nwsMaxAmmo[flat[rbp]]
setarray nwsCurrAmmo[flat[rbp]] ra`;
        },
        returns: false,
        return_type: null,
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
        ]
    },
    // ─── Fixed-point math primitives ────────────────────────────────────────
    {
        name: 'mulscale', code: 'mulscale rb', returns: true, return_type: 'variable',
        arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE]
    },
    {
        name: 'divscale', code: 'divscale rb', returns: true, return_type: 'variable',
        arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE]
    },
    {
        name: 'scalevar', code: 'scalevar rb', returns: true, return_type: 'variable',
        arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE]
    },
    // ─── int ↔ FP conversion helpers ─────────────────────────────────────────
    { name: 'intToFP11', code: (_a?: boolean) => `set rb r0\nshiftl rb 11`, returns: true, return_type: 'variable', returns_fp_bits: 11, arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'intToFP14', code: (_a?: boolean) => `set rb r0\nshiftl rb 14`, returns: true, return_type: 'variable', returns_fp_bits: 14, arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'intToFP16', code: (_a?: boolean) => `set rb r0\nshiftl rb 16`, returns: true, return_type: 'variable', returns_fp_bits: 16, arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'intToFP30', code: (_a?: boolean) => `set rb r0\nshiftl rb 30`, returns: true, return_type: 'variable', returns_fp_bits: 30, arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp11ToInt', code: (_a?: boolean) => `set rb r0\nshiftr rb 11`, returns: true, return_type: 'variable', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp14ToInt', code: (_a?: boolean) => `set rb r0\nshiftr rb 14`, returns: true, return_type: 'variable', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp16ToInt', code: (_a?: boolean) => `set rb r0\nshiftr rb 16`, returns: true, return_type: 'variable', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp30ToInt', code: (_a?: boolean) => `set rb r0\nshiftr rb 30`, returns: true, return_type: 'variable', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp11Raw', code: (_a?: boolean) => `set rb r0`, returns: true, return_type: 'variable', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp14Raw', code: (_a?: boolean) => `set rb r0`, returns: true, return_type: 'variable', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp16Raw', code: (_a?: boolean) => `set rb r0`, returns: true, return_type: 'variable', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp30Raw', code: (_a?: boolean) => `set rb r0`, returns: true, return_type: 'variable', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp11ToString', code: (_a?: boolean) => `state _convertFP11ToString`, returns: true, return_type: 'string', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp14ToString', code: (_a?: boolean) => `state _convertFP14ToString`, returns: true, return_type: 'string', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp16ToString', code: (_a?: boolean) => `state _convertFP2String`, returns: true, return_type: 'string', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp30ToString', code: (_a?: boolean) => `state _convertFP30ToString`, returns: true, return_type: 'string', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'fp16FromString', code: (_a?: boolean) => `state _stringToFP16`, returns: true, return_type: 'variable', returns_fp_bits: 16, arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'strLen', code: (_a?: boolean) => `set rb flat[r0]`, returns: true, return_type: 'variable', arguments: [CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'charCodeAt', code: (_a?: boolean) => `set ri r0\nadd ri r1\nadd ri 1\nset rb flat[ri]`, returns: true, return_type: 'variable', arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'checkEq', code: (_a?: boolean) => `state _checkEq`, returns: false, return_type: null, arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE] },
    { name: 'checkFpEq', code: (_a?: boolean) => `state _checkFpEq`, returns: false, return_type: null, arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE] },

    // ── Math object ───────────────────────────────────────────────────────────
    {
        name: 'floor', object_belong: ['Math'], returns: true, return_type: 'variable',
        fp_aware_code: (n) => n !== 0 ? `shiftr r0 ${n}\nset rb r0` : `set rb r0`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'ceil', object_belong: ['Math'], returns: true, return_type: 'variable',
        fp_aware_code: (n) => n !== 0 ? `add r0 ${(1 << n) - 1}\nshiftr r0 ${n}\nset rb r0` : `set rb r0`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'round', object_belong: ['Math'], returns: true, return_type: 'variable',
        fp_aware_code: (n) => n !== 0 ? `add r0 ${1 << (n - 1)}\nshiftr r0 ${n}\nset rb r0` : `set rb r0`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'trunc', object_belong: ['Math'], returns: true, return_type: 'variable',
        fp_aware_code: (n) => n !== 0 ? `shiftr r0 ${n}\nset rb r0` : `set rb r0`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'abs', object_belong: ['Math'], returns: true, return_type: 'variable',
        code: (_a?: boolean) => `set rb r0\nabs rb`,
        inherit_fp_bits: true,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'sqrt', object_belong: ['Math'], returns: true, return_type: 'variable',
        fp_aware_code: (n) => n !== 0 ? `sqrt r0 rb\nshiftl rb ${n >> 1}` : `sqrt r0 rb`,
        inherit_fp_bits: true,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'min', object_belong: ['Math'], returns: true, return_type: 'variable',
        code: (_a?: boolean) => `set rb r0\nifg rb r1\n  set rb r1`,
        inherit_fp_bits: true,
        arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'max', object_belong: ['Math'], returns: true, return_type: 'variable',
        code: (_a?: boolean) => `set rb r0\nifl rb r1\n  set rb r1`,
        inherit_fp_bits: true,
        arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'clamp', object_belong: ['Math'], returns: true, return_type: 'variable',
        code: (_a?: boolean) => `set rb r0\nclamp rb r1 r2`,
        inherit_fp_bits: true,
        arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'sin', object_belong: ['Math'], returns: true, return_type: 'variable', returns_fp_bits: 14,
        fp_aware_code: (n) => n === 11
            ? `shiftr r0 11\nsin rb r0`
            : n !== 0
            ? `shiftr r0 ${n}\nmul r0 2048\ndiv r0 360\nsin rb r0`
            : `sin rb r0`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'cos', object_belong: ['Math'], returns: true, return_type: 'variable', returns_fp_bits: 14,
        fp_aware_code: (n) => n === 11
            ? `shiftr r0 11\ncos rb r0`
            : n !== 0
            ? `shiftr r0 ${n}\nmul r0 2048\ndiv r0 360\ncos rb r0`
            : `cos rb r0`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'tan', object_belong: ['Math'], returns: true, return_type: 'variable', returns_fp_bits: 14,
        fp_aware_code: (n) => n === 11 ? `state _Math_tanFP11` : n !== 0 ? `state _Math_tanFP` : `state _Math_tan`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'atan2', object_belong: ['Math'], returns: true, return_type: 'variable',
        code: (_a?: boolean) => `getangle rb r0 r1`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'pow', object_belong: ['Math'], returns: true, return_type: 'variable',
        fp_aware_code: (n) => n !== 0 ? `state _Math_powFP` : `state _Math_pow`,
        inherit_fp_bits: true,
        arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'log', object_belong: ['Math'], returns: true, return_type: 'variable', returns_fp_bits: 16,
        fp_aware_code: (n) => n !== 0 ? `state _Math_logFP` : `state _Math_log`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'log2', object_belong: ['Math'], returns: true, return_type: 'variable', returns_fp_bits: 16,
        code: (_a?: boolean) => `state _Math_log2`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'log10', object_belong: ['Math'], returns: true, return_type: 'variable', returns_fp_bits: 16,
        code: (_a?: boolean) => `state _Math_log10`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'exp', object_belong: ['Math'], returns: true, return_type: 'variable', returns_fp_bits: 16,
        code: (_a?: boolean) => `state _Math_exp`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'random', object_belong: ['Math'], returns: true, return_type: 'variable',
        code: (_a?: boolean) => `displayrand rb`,
        arguments: []
    },

    {
        name: 'randomInt', object_belong: ['Math'], returns: true, return_type: 'variable',
        code: (_a?: boolean) => `displayrandvarvar rb r0`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'divr', object_belong: ['Math'], returns: true, return_type: 'variable',
        code: (_a?: boolean) => `set rb r0\ndivr rb r1`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'toBAM', object_belong: ['Math'], returns: true, return_type: 'variable',
        fp_aware_code: (n) => n !== 0
            ? `set rb r0\nshiftr rb ${n}\nmul rb 2048\ndiv rb 360`
            : `set rb r0\nmul rb 2048\ndiv rb 360`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'toDeg', object_belong: ['Math'], returns: true, return_type: 'variable',
        code: (_a?: boolean) => `set rb r0\nmul rb 360\ndiv rb 2048`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'toRad', object_belong: ['Math'], returns: true, return_type: 'variable', returns_fp_bits: 16,
        code: (_a?: boolean) => `set rb r0\nmul rb 1144`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    },

    {
        name: 'fromRad', object_belong: ['Math'], returns: true, return_type: 'variable',
        code: (_a?: boolean) => `set rb r0\ndiv rb 1144`,
        arguments: [CON_NATIVE_FLAGS.VARIABLE]
    }
]

const nativeTag: CON_NATIVE_VAR[] = [
    {
        name: 'lotag',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        init: 0,
        code: 'lotag'
    },
    {
        name: 'hitag',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        init: 0,
        code: 'hitag'
    },
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

export const nativeVars_Walls: CON_NATIVE_VAR[] = [
    {
        name: 'pos',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: nativePos
    },
    {
        name: 'point2',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'point2',
        init: 0
    },
    {
        name: 'nextWall',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'nextwall',
        init: -1
    },
    {
        name: 'nextSector',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'nextsector',
        init: -1
    },
    {
        name: 'cstat',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'cstat',
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
        name: 'overpicnum',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'overpicnum',
        init: 0
    },
    {
        name: 'shade',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'shade',
        init: 0
    },
    {
        name: 'pal',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'pal',
        init: 0
    },
    {
        name: 'texRepeat',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'xrepeat', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'yrepeat', init: 0 },
        ]
    },
    {
        name: 'texPan',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'xpanning', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'ypanning', init: 0 },
        ]
    },
    {
        name: 'tags',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: nativeTag
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
        name: 'ang',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'ang',
        init: 0
    },
    {
        name: 'blend',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'blend',
        init: 0
    },
    { name: 'uloTag', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'ulotag', init: 0 },
    { name: 'uhiTag', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'uhitag', init: 0 },
]

function nativeSectorFace(prefix: 'ceiling' | 'floor'): CON_NATIVE_VAR[] {
    return [
        { name: 'z',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, code: `${prefix}z` },
        { name: 'picnum', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, code: `${prefix}picnum` },
        { name: 'shade',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, code: `${prefix}shade` },
        { name: 'pal',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, code: `${prefix}pal` },
        { name: 'xPan',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, code: `${prefix}xpanning` },
        { name: 'yPan',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, code: `${prefix}ypanning` },
        { name: 'slope',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, code: `${prefix}slope` },
        { name: 'stat',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, code: `${prefix}stat` },
        { name: 'bunch',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, code: `${prefix}bunch` },
        { name: 'zGoal',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, code: `${prefix}zgoal` },
        { name: 'zVel',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, code: `${prefix}zvel` },
    ];
}

export const nativeVars_Sectors: CON_NATIVE_VAR[] = [
    {
        name: 'ceiling',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: nativeSectorFace('ceiling')
    },
    {
        name: 'floor',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: nativeSectorFace('floor')
    },
    {
        name: 'visibility',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'visibility',
        init: 0
    },
    {
        name: 'fogPal',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'fogpal',
        init: 0
    },
    {
        name: 'tags',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: nativeTag
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
        name: 'wallPtr',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: true,
        code: 'wallptr',
        init: 0
    },
    {
        name: 'wallNum',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: true,
        code: 'wallnum',
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
    },
    { name: 'uloTag', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'ulotag', init: 0 },
    { name: 'uhiTag', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'uhitag', init: 0 },
]

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
        name: 'curFrame',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htg_t 3',
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
        name: 'curCount',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htg_t 0',
        init: 0,
    },
    {
        name: 'curActionCount',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htg_t 2',
        init: 0,
    },
    {
        name: 'tags',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: nativeTag
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
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'xvel', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'yvel', init: 0 },
            { name: 'z', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'zvel', init: 0 },
        ]
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
    },
    {
        name: 'curSector',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: true,
        code: ['geta[ri].sectnum ri\ngetsector[ri].', 'geta[ri].sectnum ri\nsetsector[ri].'],
        init: 0,
        override_code: true,
        object: nativeVars_Sectors
    },
    {
        name: 'curSectorID',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'sectnum',
        init: -1,
    },
    {
        name: 'flags',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        init: 0,
        code: 'htflags'
    },
    {
        name: 'pal',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        init: 0,
        code: 'pal'
    },
    {
        name: 'shade',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'shade',
        init: 0
    },
    {
        name: 'cstat',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'cstat',
        init: 0
    },
    {
        name: 'statnum',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'statnum',
        init: 0
    },
    {
        name: 'clipDist',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'clipdist',
        init: 0
    },
    {
        name: 'owner',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'owner',
        init: -1
    },
    {
        name: 'repeat',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'xrepeat', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'yrepeat', init: 0 },
        ]
    },
    {
        name: 'offset',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'xoffset', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'yoffset', init: 0 },
        ]
    },
    {
        name: 'prevPos',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htbposx', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htbposy', init: 0 },
            { name: 'z', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htbposz', init: 0 },
        ]
    },
    {
        name: 'htCeilingZ',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: true,
        code: 'htceilingz',
        init: 0
    },
    {
        name: 'htFloorZ',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: true,
        code: 'htfloorz',
        init: 0
    },
    {
        name: 'htActorStayPut',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htactorstayput',
        init: 0
    },
    {
        name: 'htAng',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htang',
        init: 0
    },
    {
        name: 'htLastVX',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htlastvx',
        init: 0
    },
    {
        name: 'htLastVY',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htlastvy',
        init: 0
    },
    {
        name: 'htMovFlag',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'htmovflag',
        init: 0
    },
    {
        name: 'htTempAng',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'httempang',
        init: 0
    },
    {
        name: 'htTimeToSleep',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'httimetosleep',
        init: 0
    },
    {
        name: 'hitType',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'stayPutSector', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htactorstayput', init: 0 },
            { name: 'lastAngle',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htang',          init: 0 },
            { name: 'lastVelX',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htlastvx',       init: 0 },
            { name: 'lastVelY',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htlastvy',       init: 0 },
            { name: 'moveFlag',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htmovflag',      init: 0 },
            { name: 'tempAngle',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'httempang',      init: 0 },
            { name: 'timeToSleep',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'httimetosleep',  init: 0 },
            { name: 'ceilingZ',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'htceilingz',     init: 0 },
            { name: 'floorZ',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'htfloorz',       init: 0 },
        ]
    },
    {
        name: 'hitInfo',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'wall',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htg_t 6', init: -1 },
            { name: 'sector', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htg_t 7', init: -1 },
            { name: 'sprite', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htg_t 8', init: -1 },
        ]
    },
    {
        name: 'pitch',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        init: 0,
        override_code: true,
        code: ['getspriteext[ri].pitch ra\n', 'setspriteext[ri].pitch ra\n'] as any
    },
    {
        name: 'roll',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        init: 0,
        override_code: true,
        code: ['getspriteext[ri].roll ra\n', 'setspriteext[ri].roll ra\n'] as any
    },
    {
        name: 'angOff',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        init: 0,
        override_code: true,
        code: ['getspriteext[ri].angoff ra\n', 'setspriteext[ri].angoff ra\n'] as any
    },
    {
        name: 'alpha',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        init: 0,
        override_code: true,
        code: ['getspriteext[ri].alpha ra\n', 'setspriteext[ri].alpha ra\n'] as any
    },
    {
        name: 'mdFlags',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        init: 0,
        override_code: true,
        code: ['getspriteext[ri].mdflags ra\n', 'setspriteext[ri].mdflags ra\n'] as any
    },
    // sprite blend index (CON field: blend / deprecated alias: detail)
    { name: 'blend',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'blend',          init: 0 },
    // unsigned tag variants (read-only unsigned reinterpretations of lotag/hitag)
    { name: 'uloTag',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'ulotag',         init: 0 },
    { name: 'uhiTag',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'uhitag',         init: 0 },
    // actor_t extra fields
    { name: 'htCgg',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htcgg',          init: 0 },
    { name: 'htOwner',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htowner',        init: -1 },
    { name: 'htUMovFlag',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'htumovflag',     init: 0 },
    { name: 'htFloorZOffset', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htfloorzoffset', init: 0 },
    { name: 'htWaterZOffset', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htwaterzoffset', init: 0 },
    { name: 'htDispPicnum',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'htdispicnum',    init: 0 },
    // isvalid — computed: statnum != MAXSTATUS
    { name: 'isValid',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'isvalid',        init: 0 },
    // spriteext texture panning
    { name: 'xPanning', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, override_code: true, code: ['getspriteext[ri].xpanning ra\n', 'setspriteext[ri].xpanning ra\n'] as any },
    { name: 'yPanning', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, override_code: true, code: ['getspriteext[ri].ypanning ra\n', 'setspriteext[ri].ypanning ra\n'] as any },
    // spriteext model pivot / position offsets
    { name: 'mdXOff',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, override_code: true, code: ['getspriteext[ri].mdxoff ra\n',    'setspriteext[ri].mdxoff ra\n']    as any },
    { name: 'mdYOff',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, override_code: true, code: ['getspriteext[ri].mdyoff ra\n',    'setspriteext[ri].mdyoff ra\n']    as any },
    { name: 'mdZOff',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, override_code: true, code: ['getspriteext[ri].mdzoff ra\n',    'setspriteext[ri].mdzoff ra\n']    as any },
    { name: 'mdPosXOff', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, override_code: true, code: ['getspriteext[ri].mdposxoff ra\n', 'setspriteext[ri].mdposxoff ra\n'] as any },
    { name: 'mdPosYOff', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, override_code: true, code: ['getspriteext[ri].mdposyoff ra\n', 'setspriteext[ri].mdposyoff ra\n'] as any },
    { name: 'mdPosZOff', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, init: 0, override_code: true, code: ['getspriteext[ri].mdposzoff ra\n', 'setspriteext[ri].mdposzoff ra\n'] as any },
];

export const nativeVars_Players: CON_NATIVE_VAR[] = [
    {
        name: 'weaponSystem',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: true,
        code: '',
        init: 0,
        object: [
            {
                name: 'ammoAmount',
                var_type: CON_NATIVE_TYPE.array,
                type: CON_NATIVE_FLAGS.ARRAY,
                readonly: false,
                code: 'ammo_amount rsi',
                init: 0
            },
            {
                name: 'gotWeapon',
                var_type: CON_NATIVE_TYPE.array,
                type: CON_NATIVE_FLAGS.ARRAY,
                readonly: false,
                code: 'gotweapon rsi',
                init: 0
            },
            {
                name: 'maxAmmoAmount',
                var_type: CON_NATIVE_TYPE.array,
                type: CON_NATIVE_FLAGS.ARRAY,
                readonly: false,
                code: 'max_ammo_amount rsi',
                init: 0
            },
            {
                name: 'subOrNot',
                var_type: CON_NATIVE_TYPE.array,
                type: CON_NATIVE_FLAGS.ARRAY,
                readonly: false,
                code: 'bsubweapon rsi',
                init: 0
            },
            {
                name: 'currWeapon',
                var_type: CON_NATIVE_TYPE.native,
                type: CON_NATIVE_FLAGS.VARIABLE,
                readonly: false,
                code: 'curr_weapon',
                init: 0
            },
            {
                name: 'weaponAnim',
                var_type: CON_NATIVE_TYPE.native,
                type: CON_NATIVE_FLAGS.VARIABLE,
                readonly: false,
                code: 'kickback_pic',
                init: 0
            },
        ]
    },
    {
        name: 'actor',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: true,
        code: ['getp[ri].i ri\ngeta[ri].', 'getp[ri].i ri\nseta[ri].'],
        init: 0,
        override_code: true,
        object: nativeVars_Sprites
    },
    {
        name: 'pos',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: true,
        code: '',
        init: 0,
        object: [
            {
                name: 'x',
                var_type: CON_NATIVE_TYPE.native,
                type: CON_NATIVE_FLAGS.VARIABLE,
                readonly: false,
                code: 'posx',
                init: 0
            },
            {
                name: 'y',
                var_type: CON_NATIVE_TYPE.native,
                type: CON_NATIVE_FLAGS.VARIABLE,
                readonly: false,
                code: 'posy',
                init: 0
            },
            {
                name: 'z',
                var_type: CON_NATIVE_TYPE.native,
                type: CON_NATIVE_FLAGS.VARIABLE,
                readonly: false,
                code: 'posz',
                init: 0
            }
        ]
    },
    {
        name: 'previousPos',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: true,
        code: '',
        init: 0,
        object: [
            {
                name: 'x',
                var_type: CON_NATIVE_TYPE.native,
                type: CON_NATIVE_FLAGS.VARIABLE,
                readonly: false,
                code: 'oposx',
                init: 0
            },
            {
                name: 'y',
                var_type: CON_NATIVE_TYPE.native,
                type: CON_NATIVE_FLAGS.VARIABLE,
                readonly: false,
                code: 'oposy',
                init: 0
            },
            {
                name: 'z',
                var_type: CON_NATIVE_TYPE.native,
                type: CON_NATIVE_FLAGS.VARIABLE,
                readonly: false,
                code: 'oposz',
                init: 0
            }
        ]
    },
    {
        name: 'vel',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: true,
        code: '',
        init: 0,
        object: [
            {
                name: 'x',
                var_type: CON_NATIVE_TYPE.native,
                type: CON_NATIVE_FLAGS.VARIABLE,
                readonly: false,
                code: 'posxv',
                init: 0
            },
            {
                name: 'y',
                var_type: CON_NATIVE_TYPE.native,
                type: CON_NATIVE_FLAGS.VARIABLE,
                readonly: false,
                code: 'posyv',
                init: 0
            },
            {
                name: 'z',
                var_type: CON_NATIVE_TYPE.native,
                type: CON_NATIVE_FLAGS.VARIABLE,
                readonly: false,
                code: 'poszv',
                init: 0
            }
        ]
    },
    {
        name: 'currSector',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: true,
        code: ['getp[ri].cursectnum ri\ngetsector[ri].', 'getp[ri].cursectnum ri\nsetsector[ri].'],
        init: 0,
        override_code: true,
        object: nativeVars_Sectors
    },
    {
        name: 'currSectorID',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'cursectnum',
        init: 0,
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
        name: 'angVel',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'angvel',
        init: 0
    },
    {
        name: 'previousAng',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'oang',
        init: 0
    },
    {
        name: 'horiz',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'horiz',
        init: 0
    },
    {
        name: 'verticalAngle',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'horiz',
        init: 0
    },
    {
        name: 'horizOff',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'horizoff',
        init: 0
    },
    {
        name: 'verticalAngleOff',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'horizoff',
        init: 0
    },
    {
        name: 'health',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'max_player_health',
        init: 100
    },
    {
        name: 'shieldAmount',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'shield_amount',
        init: 0
    },
    {
        name: 'jetpackAmount',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'jetpack_amount',
        init: 0
    },
    {
        name: 'scubaAmount',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'scuba_amount',
        init: 0
    },
    {
        name: 'steroidsAmount',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'steroids_amount',
        init: 0
    },
    {
        name: 'lastWeapon',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'last_weapon',
        init: 0
    },
    {
        name: 'weaponPos',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'weapon_pos',
        init: 0
    },
    {
        name: 'kickbackPic',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'kickback_pic',
        init: 0
    },
    {
        name: 'weaponSwitch',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'weaponswitch',
        init: 0
    },
    {
        name: 'zoom',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'zoom',
        init: 512
    },
    {
        name: 'bobCounter',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'bobcounter',
        init: 0
    },
    {
        name: 'onGround',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'on_ground',
        init: 0
    },
    {
        name: 'onLadder',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'on_ladder',
        init: 0
    },
    {
        name: 'jumping',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'jumping_toggle',
        init: 0
    },
    {
        name: 'crouching',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'crouch_toggle',
        init: 0
    },
    {
        name: 'god',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'god',
        init: 0
    },
    {
        name: 'dead',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'dead_flag',
        init: 0
    },
    {
        name: 'actorsKilled',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'actors_killed',
        init: 0
    },
    {
        name: 'secretRooms',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'secret_rooms',
        init: 0
    },
    {
        name: 'totalKills',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'total_kills',
        init: 0
    },
    {
        name: 'spriteIndex',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: true,
        code: 'i',
        init: 0
    },
    {
        name: 'fta',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'fta',
        init: 0
    },
    {
        name: 'ftq',
        var_type: CON_NATIVE_TYPE.native,
        type: CON_NATIVE_FLAGS.VARIABLE,
        readonly: false,
        code: 'ftq',
        init: 0
    },
    {
        name: 'frags',
        var_type: CON_NATIVE_TYPE.array,
        type: CON_NATIVE_FLAGS.ARRAY,
        readonly: false,
        code: 'frags rsi',
        init: 0
    },
    {
        name: 'invAmount',
        var_type: CON_NATIVE_TYPE.array,
        type: CON_NATIVE_FLAGS.ARRAY,
        readonly: false,
        code: 'inv_amount rsi',
        init: 0
    },
    {
        name: 'resources',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'health',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'max_player_health', init: 100 },
            { name: 'shield',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'shield_amount',     init: 0 },
            { name: 'jetpack',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'jetpack_amount',    init: 0 },
            { name: 'scuba',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'scuba_amount',      init: 0 },
            { name: 'steroids', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'steroids_amount',   init: 0 },
            { name: 'amounts',  var_type: CON_NATIVE_TYPE.array,  type: CON_NATIVE_FLAGS.ARRAY,    readonly: false, code: 'inv_amount rsi',    init: 0 },
        ]
    },
    {
        name: 'status',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'onGround',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'on_ground',      init: 0 },
            { name: 'onLadder',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'on_ladder',      init: 0 },
            { name: 'jumping',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'jumping_toggle', init: 0 },
            { name: 'crouching', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'crouch_toggle',  init: 0 },
            { name: 'god',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'god',            init: 0 },
            { name: 'dead',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'dead_flag',      init: 0 },
        ]
    },
    {
        name: 'stats',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'actorsKilled', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'actors_killed', init: 0 },
            { name: 'secretRooms',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'secret_rooms',  init: 0 },
            { name: 'totalKills',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'total_kills',   init: 0 },
        ]
    },
    // fixed-point angle/horizon variants (raw q16 values, 65536 = 1 integer unit)
    { name: 'q16Horiz',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'q16horiz',     init: 0 },
    { name: 'q16HorizOff',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'q16horizoff',  init: 0 },
    { name: 'oq16Horiz',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'oq16horiz',    init: 0 },
    { name: 'oq16HorizOff', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'oq16horizoff', init: 0 },
    { name: 'q16Ang',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'q16ang',       init: 0 },
    { name: 'oq16Ang',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'oq16ang',      init: 0 },
    { name: 'q16AngVel',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'q16angvel',    init: 0 },
    // physics/movement constants
    { name: 'gravity',             var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gravity',             init: 0 },
    { name: 'runSpeed',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'runspeed',            init: 0 },
    { name: 'floorZOffset',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'floorzoffset',        init: 0 },
    { name: 'spriteZOffset',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'spritezoffset',       init: 0 },
    { name: 'minWaterZDist',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'minwaterzdist',       init: 0 },
    { name: 'waterZOffset',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'waterzoffset',        init: 0 },
    { name: 'shrunkZOffset',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'shrunkzoffset',       init: 0 },
    { name: 'crouchZIncrement',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'crouchzincrement',    init: 0 },
    { name: 'crouchSpeedModifier', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'crouchspeedmodifier', init: 0 },
    { name: 'swimSpeedModifier',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'swimspeedmodifier',   init: 0 },
    { name: 'swimZIncrement',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'swimzincrement',      init: 0 },
    { name: 'minSwimZVel',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'minswimzvel',         init: 0 },
    { name: 'maxSwimZVel',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'maxswimzvel',         init: 0 },
    { name: 'jetpackZIncrement',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'jetpackzincrement',   init: 0 },
    // gameplay state
    { name: 'invDispTime',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'invdisptime',       init: 0 },
    { name: 'bobPosX',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'bobposx',           init: 0 },
    { name: 'bobPosY',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'bobposy',           init: 0 },
    { name: 'pyOff',             var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'pyoff',             init: 0 },
    { name: 'opyOff',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'opyoff',            init: 0 },
    { name: 'lastPissedTime',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'last_pissed_time',  init: 0 },
    { name: 'trueFZ',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'truefz',            init: 0 },
    { name: 'trueCZ',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'truecz',            init: 0 },
    { name: 'playerPar',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'player_par',        init: 0 },
    { name: 'visibility',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'visibility',        init: 0 },
    { name: 'weaponSway',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'weapon_sway',       init: 0 },
    { name: 'palsTime',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'pals_time',         init: 0 },
    { name: 'crackTime',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'crack_time',        init: 0 },
    { name: 'aimMode',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'aim_mode',          init: 0 },
    { name: 'lookAng',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'look_ang',          init: 0 },
    { name: 'oLookAng',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'olook_ang',         init: 0 },
    { name: 'oRotScrnAng',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'orotscrnang',       init: 0 },
    { name: 'lastExtra',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'last_extra',        init: 0 },
    { name: 'subweapon',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'subweapon',         init: 0 },
    { name: 'wackedByActor',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'wackedbyactor',     init: 0 },
    { name: 'frag',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'frag',              init: 0 },
    { name: 'fraggedSelf',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'fraggedself',       init: 0 },
    { name: 'tipIncs',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'tipincs',           init: 0 },
    { name: 'wantWeaponFire',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'wantweaponfire',    init: 0 },
    { name: 'holoDukeAmount',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'holoduke_amount',   init: 0 },
    { name: 'newOwner',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'newowner',          init: 0 },
    { name: 'hurtDelay',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'hurt_delay',        init: 0 },
    { name: 'hbombHoldDelay',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'hbomb_hold_delay',  init: 0 },
    { name: 'jumpingCounter',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'jumping_counter',   init: 0 },
    { name: 'airLeft',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'airleft',           init: 0 },
    { name: 'kneeIncs',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'knee_incs',         init: 0 },
    { name: 'accessIncs',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'access_incs',       init: 0 },
    { name: 'accessWallNum',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'access_wallnum',    init: 0 },
    { name: 'accessSpriteNum',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'access_spritenum',  init: 0 },
    { name: 'gotAccess',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'got_access',        init: 0 },
    { name: 'weaponAng',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'weapon_ang',        init: 0 },
    { name: 'firstAidAmount',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'firstaid_amount',   init: 0 },
    { name: 'somethingOnPlayer', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'somethingonplayer', init: 0 },
    { name: 'onCrane',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'on_crane',          init: 0 },
    { name: 'parallaxSectnum',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'parallax_sectnum',  init: 0 },
    { name: 'overShoulderOn',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'over_shoulder_on',  init: 0 },
    { name: 'randomClubFrame',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'random_club_frame', init: 0 },
    { name: 'fistIncs',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'fist_incs',         init: 0 },
    { name: 'oneEightyCount',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'one_eighty_count',  init: 0 },
    { name: 'cheatPhase',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'cheat_phase',       init: 0 },
    { name: 'dummyPlayerSprite', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'dummyplayersprite', init: 0 },
    { name: 'extraExtra8',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'extra_extra8',      init: 0 },
    { name: 'quickKick',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'quick_kick',        init: 0 },
    { name: 'heatAmount',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'heat_amount',       init: 0 },
    { name: 'actorSqu',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'actorsqu',          init: 0 },
    { name: 'timeBeforeExit',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'timebeforeexit',    init: 0 },
    { name: 'customExitSound',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'customexitsound',   init: 0 },
    { name: 'weapRecCnt',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'weapreccnt',        init: 0 },
    { name: 'interfaceToggle',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'interface_toggle',  init: 0 },
    { name: 'rotScrnAng',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'rotscrnang',        init: 0 },
    { name: 'showEmptyWeapon',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'show_empty_weapon', init: 0 },
    { name: 'holoDukeOn',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'holoduke_on',       init: 0 },
    { name: 'pyCount',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'pycount',           init: 0 },
    { name: 'fragPs',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'frag_ps',           init: 0 },
    { name: 'transporterHold',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'transporter_hold',  init: 0 },
    { name: 'clipDist',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'clipdist',          init: 0 },
    { name: 'lastFullWeapon',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'last_full_weapon',  init: 0 },
    { name: 'footprintShade',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'footprintshade',    init: 0 },
    { name: 'bootAmount',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'boot_amount',       init: 0 },
    { name: 'screamVoice',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'scream_voice',      init: 0 },
    { name: 'gm',                var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gm',                init: 0 },
    { name: 'onWarpingSector',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'on_warping_sector', init: 0 },
    { name: 'footprintCount',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'footprintcount',    init: 0 },
    { name: 'hbombOn',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'hbomb_on',          init: 0 },
    { name: 'rapidFireHold',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'rapid_fire_hold',   init: 0 },
    { name: 'invenIcon',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'inven_icon',        init: 0 },
    { name: 'buttonPalette',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'buttonpalette',     init: 0 },
    { name: 'jetpackOn',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'jetpack_on',        init: 0 },
    { name: 'spriteBridge',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'spritebridge',      init: 0 },
    { name: 'scubaOn',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'scuba_on',          init: 0 },
    { name: 'footprintPal',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'footprintpal',      init: 0 },
    { name: 'heatOn',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'heat_on',           init: 0 },
    { name: 'holsterWeapon',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'holster_weapon',    init: 0 },
    { name: 'fallingCounter',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'falling_counter',   init: 0 },
    { name: 'palette',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'palette',           init: 0 },
    { name: 'toggleKeyFlag',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'toggle_key_flag',   init: 0 },
    { name: 'knuckleIncs',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'knuckle_incs',      init: 0 },
    { name: 'walkingSndToggle',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'walking_snd_toggle',init: 0 },
    { name: 'palookup',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'palookup',          init: 0 },
    { name: 'hardLanding',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'hard_landing',      init: 0 },
    { name: 'maxSecretRooms',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'max_secret_rooms',  init: 0 },
    { name: 'maxActorsKilled',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'max_actors_killed', init: 0 },
    { name: 'returnToCenter',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'return_to_center',  init: 0 },
    { name: 'sbs',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'sbs',               init: 0 },
    { name: 'reloading',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'reloading',         init: 0 },
    { name: 'autoAim',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'auto_aim',          init: 0 },
    { name: 'movementLock',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'movement_lock',     init: 0 },
    { name: 'soundPitch',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'sound_pitch',       init: 0 },
    { name: 'team',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'team',              init: 0 },
    { name: 'maxShieldAmount',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'max_shield_amount', init: 0 },
    { name: 'lastQuickKick',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'last_quick_kick',   init: 0 },
    { name: 'autoStep',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'autostep',          init: 0 },
    { name: 'autoStepSbw',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'autostep_sbw',      init: 0 },
    { name: 'deaths',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'deaths',            init: 0 },
    { name: 'lastUsedWeapon',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'last_used_weapon',  init: 0 },
    { name: 'floorZRebound',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'floorzrebound',     init: 0 },
    { name: 'floorZCutoff',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'floorzcutoff',      init: 0 },
    { name: 'numLoogs',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'numloogs',          init: 0 },
    { name: 'loogCnt',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'loogcnt',           init: 0 },
]

export const nativeVars_Projectiles: CON_NATIVE_VAR[] = [
    { name: 'vel',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'vel',        init: 0 },
    { name: 'velMult',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'velmult',    init: 0 },
    { name: 'bounces',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'bounces',    init: 0 },
    { name: 'bSound',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'bsound',     init: 0 },
    { name: 'iSound',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'isound',     init: 0 },
    { name: 'sound',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'sound',      init: 0 },
    { name: 'range',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'range',      init: 0 },
    { name: 'drop',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'drop',       init: 0 },
    { name: 'hitRadius',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'hitradius',  init: 0 },
    { name: 'offset',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'offset',     init: 0 },
    { name: 'trail',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'trail',      init: 0 },
    { name: 'tnum',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'tnum',       init: 0 },
    { name: 'tOffset',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'toffset',    init: 0 },
    { name: 'txRepeat',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'txrepeat',   init: 0 },
    { name: 'tyRepeat',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'tyrepeat',   init: 0 },
    { name: 'sxRepeat',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'sxrepeat',   init: 0 },
    { name: 'syRepeat',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'syrepeat',   init: 0 },
    {
        name: 'trailRepeat',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'txrepeat', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'tyrepeat', init: 0 },
        ]
    },
    {
        name: 'spriteRepeat',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'sxrepeat', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'syrepeat', init: 0 },
        ]
    },
    { name: 'shade',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'shade',      init: 0 },
    { name: 'pal',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'pal',        init: 0 },
    { name: 'cstat',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'cstat',      init: 0 },
    { name: 'clipDist',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'clipdist',   init: 0 },
    { name: 'decal',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'decal',      init: 0 },
    { name: 'extra',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'extra',      init: 0 },
    { name: 'extraRand',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'extra_rand', init: 0 },
    { name: 'userdata',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'userdata',   init: 0 },
    { name: 'flashColor', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'flashcolor', init: 0 },
    { name: 'spawns',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'spawns',     init: 0 },
    { name: 'worksLike',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'workslike',  init: 0 },
    { name: 'xRepeat',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'xrepeat',    init: 0 },
    { name: 'yRepeat',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'yrepeat',    init: 0 },
    {
        name: 'physics',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'vel',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'vel',      init: 0 },
            { name: 'velMult',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'velmult',  init: 0 },
            { name: 'drop',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'drop',     init: 0 },
            { name: 'range',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'range',    init: 0 },
            { name: 'bounces',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'bounces',  init: 0 },
            { name: 'offset',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'offset',   init: 0 },
            { name: 'clipDist', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'clipdist', init: 0 },
        ]
    },
    {
        name: 'audio',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'fire',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'isound', init: 0 },
            { name: 'bounce', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'bsound', init: 0 },
            { name: 'impact', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'sound',  init: 0 },
        ]
    },
    {
        name: 'trailConfig',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'enabled',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'trail',    init: 0 },
            { name: 'sprite',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'tnum',     init: 0 },
            { name: 'offset',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'toffset',  init: 0 },
            { name: 'txRepeat', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'txrepeat', init: 0 },
            { name: 'tyRepeat', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'tyrepeat', init: 0 },
            { name: 'sxRepeat', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'sxrepeat', init: 0 },
            { name: 'syRepeat', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'syrepeat', init: 0 },
        ]
    },
    {
        name: 'appearance',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'shade',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'shade',   init: 0 },
            { name: 'pal',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'pal',     init: 0 },
            { name: 'cstat',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'cstat',   init: 0 },
            { name: 'xRepeat', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'xrepeat', init: 0 },
            { name: 'yRepeat', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'yrepeat', init: 0 },
        ]
    },
    {
        name: 'effect',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'hitRadius',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'hitradius',  init: 0 },
            { name: 'decal',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'decal',      init: 0 },
            { name: 'flashColor', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'flashcolor', init: 0 },
            { name: 'extra',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'extra',      init: 0 },
            { name: 'extraRand',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'extra_rand', init: 0 },
            { name: 'spawns',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'spawns',     init: 0 },
        ]
    },
]

export const nativeVars_TSprites: CON_NATIVE_VAR[] = [
    {
        name: 'pos',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: nativePos
    },
    {
        name: 'vel',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'xvel', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'yvel', init: 0 },
            { name: 'z', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'zvel', init: 0 },
        ]
    },
    {
        name: 'repeat',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'xrepeat', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'yrepeat', init: 0 },
        ]
    },
    {
        name: 'offset',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'xoffset', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'yoffset', init: 0 },
        ]
    },
    { name: 'ang',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'ang',      init: 0 },
    { name: 'picnum',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'picnum',   init: 0 },
    { name: 'shade',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'shade',    init: 0 },
    { name: 'pal',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'pal',      init: 0 },
    { name: 'cstat',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'cstat',    init: 0 },
    { name: 'owner',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'owner',    init: -1 },
    { name: 'statnum',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'statnum',  init: 0 },
    { name: 'sectnum',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'sectnum',  init: 0 },
    { name: 'extra',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'extra',    init: 0 },
    { name: 'clipDist', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'clipdist', init: 0 },
    { name: 'blend',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'blend',    init: 0 },
    {
        name: 'tags',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: nativeTag
    },
]

export const nativeVars_UserDef: CON_NATIVE_VAR[] = [
    { name: 'brightness',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'brightness',   init: 0 },
    { name: 'god',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'god',          init: 0 },
    { name: 'levelNum',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'level_number', init: 0 },
    { name: 'volumeNum',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'volume_number',init: 0 },
    { name: 'multiMode',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'multimode',    init: 0 },
    { name: 'numPlayers',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'numplayers',   init: 1 },
    { name: 'musicEpisode', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'music_episode',init: 0 },
    { name: 'musicLevel',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'music_level',  init: 0 },
    { name: 'playerSkill',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'player_skill', init: 0 },
    { name: 'cameraDist',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'cameradist',   init: 0 },
    { name: 'cameraClock',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'cameraclock',  init: 0 },
    { name: 'scrollMode',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'scrollmode',   init: 0 },
    { name: 'screenSize',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'screensize',   init: 0 },
    { name: 'coop',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'coop',         init: 0 },
    { name: 'returnData',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.ARRAY,    readonly: false, code: 'return rsi',   init: 0 },
    {
        name: 'level',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'number',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'level_number',  init: 0 },
            { name: 'volume',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'volume_number', init: 0 },
            { name: 'skill',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'player_skill',  init: 0 },
            { name: 'musicEpisode', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'music_episode', init: 0 },
            { name: 'musicLevel',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'music_level',   init: 0 },
        ]
    },
    {
        name: 'screen',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'brightness', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'brightness', init: 0 },
            { name: 'size',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'screensize', init: 0 },
            { name: 'scrollMode', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'scrollmode', init: 0 },
        ]
    },
    {
        name: 'camera',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'dist',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'cameradist',  init: 0 },
            { name: 'clock', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'cameraclock', init: 0 },
        ]
    },
    {
        name: 'multi',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'mode',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'multimode',  init: 0 },
            { name: 'numPlayers', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true,  code: 'numplayers', init: 1 },
            { name: 'coop',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'coop',       init: 0 },
        ]
    },
    // additional userdef fields from UserdefsLabels[] in gamestructures.cpp
    { name: 'warpOn',                var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'warp_on',                init: 0 },
    { name: 'cashman',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'cashman',                init: 0 },
    { name: 'eog',                   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'eog',                    init: 0 },
    { name: 'showAllMap',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'showallmap',             init: 0 },
    { name: 'showHelp',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'show_help',              init: 0 },
    { name: 'clipping',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'clipping',               init: 0 },
    { name: 'overheadOn',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'overhead_on',            init: 0 },
    { name: 'lastOverhead',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'last_overhead',          init: 0 },
    { name: 'showWeapons',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'showweapons',            init: 0 },
    { name: 'pauseOn',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'pause_on',               init: 0 },
    { name: 'fromBonus',             var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'from_bonus',             init: 0 },
    { name: 'cameraSprite',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'camerasprite',           init: 0 },
    { name: 'lastCamSprite',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'last_camsprite',         init: 0 },
    { name: 'lastLevel',             var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'last_level',             init: 0 },
    { name: 'secretLevel',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'secretlevel',            init: 0 },
    { name: 'constVisibility',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'const_visibility',       init: 0 },
    { name: 'uwFramerate',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'uw_framerate',           init: 0 },
    { name: 'cameraTime',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'camera_time',            init: 0 },
    { name: 'folFvel',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'folfvel',                init: 0 },
    { name: 'folSvel',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'folsvel',                init: 0 },
    { name: 'folAvel',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'folavel',                init: 0 },
    { name: 'folX',                  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'folx',                   init: 0 },
    { name: 'folY',                  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'foly',                   init: 0 },
    { name: 'folA',                  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'fola',                   init: 0 },
    { name: 'recCnt',                var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'reccnt',                 init: 0 },
    { name: 'enteredName',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'entered_name',           init: 0 },
    { name: 'screenTilting',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'screen_tilting',         init: 0 },
    { name: 'shadows',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'shadows',                init: 0 },
    { name: 'ftaOn',                 var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'fta_on',                 init: 0 },
    { name: 'executions',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'executions',             init: 0 },
    { name: 'autoRun',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'auto_run',               init: 0 },
    { name: 'coords',                var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'coords',                 init: 0 },
    { name: 'tickrate',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'tickrate',               init: 0 },
    { name: 'mCoop',                 var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_coop',                 init: 0 },
    { name: 'screenSizeUD',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'screen_size',            init: 0 },
    { name: 'lockout',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'lockout',                init: 0 },
    { name: 'crosshair',             var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'crosshair',              init: 0 },
    { name: 'playerAI',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'playerai',               init: 0 },
    { name: 'respawnMonsters',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'respawn_monsters',       init: 0 },
    { name: 'respawnItems',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'respawn_items',          init: 0 },
    { name: 'respawnInventory',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'respawn_inventory',      init: 0 },
    { name: 'recstat',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'recstat',                init: 0 },
    { name: 'monstersOff',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'monsters_off',           init: 0 },
    { name: 'mRespawnItems',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_respawn_items',        init: 0 },
    { name: 'mRespawnMonsters',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_respawn_monsters',     init: 0 },
    { name: 'mRespawnInventory',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_respawn_inventory',    init: 0 },
    { name: 'mRecstat',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_recstat',              init: 0 },
    { name: 'mMonstersOff',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_monsters_off',         init: 0 },
    { name: 'udDetail',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'detail',                 init: 0 },
    { name: 'mFfire',                var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_ffire',                init: 0 },
    { name: 'ffire',                 var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'ffire',                  init: 0 },
    { name: 'mPlayerSkill',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_player_skill',         init: 0 },
    { name: 'mLevelNumber',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_level_number',         init: 0 },
    { name: 'mVolumeNumber',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_volume_number',        init: 0 },
    { name: 'mMarker',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_marker',               init: 0 },
    { name: 'marker',                var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'marker',                 init: 0 },
    { name: 'mouseflip',             var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'mouseflip',              init: 0 },
    { name: 'statusbarscale',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'statusbarscale',         init: 0 },
    { name: 'drawweapon',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'drawweapon',             init: 0 },
    { name: 'mouseaiming',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'mouseaiming',            init: 0 },
    { name: 'udWeaponswitch',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'weaponswitch',           init: 0 },
    { name: 'democams',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'democams',               init: 0 },
    { name: 'color',                 var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'color',                  init: 0 },
    { name: 'msgdisptime',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'msgdisptime',            init: 0 },
    { name: 'statusbarmode',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'statusbarmode',          init: 0 },
    { name: 'mNoexits',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_noexits',              init: 0 },
    { name: 'noexits',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'noexits',                init: 0 },
    { name: 'autovote',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'autovote',               init: 0 },
    { name: 'automsg',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'automsg',                init: 0 },
    { name: 'idplayers',             var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'idplayers',              init: 0 },
    { name: 'udTeam',                var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'team',                   init: 0 },
    { name: 'viewbob',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'viewbob',                init: 0 },
    { name: 'weaponsway',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'weaponsway',             init: 0 },
    { name: 'obituaries',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'obituaries',             init: 0 },
    { name: 'levelstats',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'levelstats',             init: 0 },
    { name: 'crosshairscale',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'crosshairscale',         init: 0 },
    { name: 'althud',                var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'althud',                 init: 0 },
    { name: 'displayBonusScreen',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'display_bonus_screen',   init: 0 },
    { name: 'showLevelText',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'show_level_text',        init: 0 },
    { name: 'weaponscale',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'weaponscale',            init: 0 },
    { name: 'textscale',             var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'textscale',              init: 0 },
    { name: 'runkeyMode',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'runkey_mode',            init: 0 },
    { name: 'mOriginX',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_origin_x',             init: 0 },
    { name: 'mOriginY',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_origin_y',             init: 0 },
    { name: 'playerbest',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'playerbest',             init: 0 },
    { name: 'musictoggle',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'musictoggle',            init: 0 },
    { name: 'usevoxels',             var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'usevoxels',              init: 0 },
    { name: 'usehightile',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'usehightile',            init: 0 },
    { name: 'usemodels',             var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'usemodels',              init: 0 },
    { name: 'gametypeflags',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gametypeflags',          init: 0 },
    { name: 'mGametypeflags',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'm_gametypeflags',        init: 0 },
    { name: 'globalflags',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'globalflags',            init: 0 },
    { name: 'globalgameflags',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'globalgameflags',        init: 0 },
    { name: 'vmPlayer',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'vm_player',              init: 0 },
    { name: 'vmSprite',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'vm_sprite',              init: 0 },
    { name: 'vmDistance',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'vm_distance',            init: 0 },
    { name: 'soundtoggle',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'soundtoggle',            init: 0 },
    { name: 'gametextTracking',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gametext_tracking',      init: 0 },
    { name: 'mgametextTracking',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'mgametext_tracking',     init: 0 },
    { name: 'menutextTracking',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menutext_tracking',      init: 0 },
    { name: 'maxSpritesOnScreen',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'maxspritesonscreen',     init: 0 },
    { name: 'screenareaX1',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'screenarea_x1',          init: 0 },
    { name: 'screenareaY1',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'screenarea_y1',          init: 0 },
    { name: 'screenareaX2',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'screenarea_x2',          init: 0 },
    { name: 'screenareaY2',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'screenarea_y2',          init: 0 },
    { name: 'screenfade',            var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'screenfade',             init: 0 },
    { name: 'menubackground',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menubackground',         init: 0 },
    { name: 'statusbarflags',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'statusbarflags',         init: 0 },
    { name: 'statusbarrange',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'statusbarrange',         init: 0 },
    { name: 'statusbarcustom',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'statusbarcustom',        init: 0 },
    { name: 'hudontop',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'hudontop',               init: 0 },
    { name: 'menuSlidebarZ',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menu_slidebarz',         init: 0 },
    { name: 'menuSlidebarMargin',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menu_slidebarmargin',    init: 0 },
    { name: 'menuSlidecursorZ',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menu_slidecursorz',      init: 0 },
    { name: 'globalR',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'global_r',               init: 0 },
    { name: 'globalG',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'global_g',               init: 0 },
    { name: 'globalB',               var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'global_b',               init: 0 },
    { name: 'defaultVolume',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'default_volume',         init: 0 },
    { name: 'defaultSkill',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'default_skill',          init: 0 },
    { name: 'menuShadeDeselected',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menu_shadedeselected',   init: 0 },
    { name: 'menuShadeDisabled',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menu_shadedisabled',     init: 0 },
    { name: 'menutextZoom',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menutext_zoom',          init: 0 },
    { name: 'menutextXspace',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menutext_xspace',        init: 0 },
    { name: 'menutextPal',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menutext_pal',           init: 0 },
    { name: 'menutextPalselected',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menutext_palselected',   init: 0 },
    { name: 'menutextPaldeselected', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menutext_paldeselected', init: 0 },
    { name: 'menutextPaldisabled',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menutext_paldisabled',   init: 0 },
    { name: 'menutextPalselectedR',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menutext_palselected_right',   init: 0 },
    { name: 'menutextPaldeselectedR',var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menutext_paldeselected_right', init: 0 },
    { name: 'menutextPaldisabledR',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menutext_paldisabled_right',   init: 0 },
    { name: 'gametextZoom',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gametext_zoom',          init: 0 },
    { name: 'gametextXspace',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gametext_xspace',        init: 0 },
    { name: 'gametextPal',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gametext_pal',           init: 0 },
    { name: 'gametextPalselected',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gametext_palselected',   init: 0 },
    { name: 'gametextPaldeselected', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gametext_paldeselected', init: 0 },
    { name: 'gametextPaldisabled',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gametext_paldisabled',   init: 0 },
    { name: 'gametextPalselectedR',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gametext_palselected_right',   init: 0 },
    { name: 'gametextPaldeselectedR',var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gametext_paldeselected_right', init: 0 },
    { name: 'gametextPaldisabledR',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gametext_paldisabled_right',   init: 0 },
    { name: 'minitextZoom',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'minitext_zoom',          init: 0 },
    { name: 'minitextXspace',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'minitext_xspace',        init: 0 },
    { name: 'minitextTracking',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'minitext_tracking',      init: 0 },
    { name: 'minitextPal',           var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'minitext_pal',           init: 0 },
    { name: 'minitextPalselected',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'minitext_palselected',   init: 0 },
    { name: 'minitextPaldeselected', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'minitext_paldeselected', init: 0 },
    { name: 'minitextPaldisabled',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'minitext_paldisabled',   init: 0 },
    { name: 'minitextPalselectedR',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'minitext_palselected_right',   init: 0 },
    { name: 'minitextPaldeselectedR',var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'minitext_paldeselected_right', init: 0 },
    { name: 'minitextPaldisabledR',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'minitext_paldisabled_right',   init: 0 },
    { name: 'menutitlePal',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menutitle_pal',          init: 0 },
    { name: 'slidebarPalselected',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'slidebar_palselected',   init: 0 },
    { name: 'slidebarPaldisabled',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'slidebar_paldisabled',   init: 0 },
    { name: 'shadowPal',             var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'shadow_pal',             init: 0 },
    { name: 'menuScrollbarTilenum',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menu_scrollbartilenum',  init: 0 },
    { name: 'menuScrollbarZ',        var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menu_scrollbarz',        init: 0 },
    { name: 'menuScrollcursorZ',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'menu_scrollcursorz',     init: 0 },
    { name: 'quoteYOffset',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'quote_yoffset',          init: 0 },
    { name: 'userByteVersion',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'userbyteversion',        init: 0 },
    { name: 'autosave',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'autosave',               init: 0 },
    { name: 'drawY',                 var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'draw_y',                 init: 0 },
    { name: 'drawYxaspect',          var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'draw_yxaspect',          init: 0 },
    { name: 'fov',                   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'fov',                    init: 0 },
    { name: 'gamepadactive',         var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'gamepadactive',          init: 0 },
    { name: 'kickMode',              var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'kick_mode',              init: 0 },
]

export const nativeVars_Input: CON_NATIVE_VAR[] = [
    { name: 'fvel',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'fvel',    init: 0 },
    { name: 'svel',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'svel',    init: 0 },
    { name: 'avel',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'avel',    init: 0 },
    { name: 'horz',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'horz',    init: 0 },
    { name: 'bits',       var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'bits',    init: 0 },
    { name: 'extBits',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'extbits', init: 0 },
    // friendly aliases
    { name: 'forwardVel', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'fvel',    init: 0 },
    { name: 'strafeVel',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'svel',    init: 0 },
    { name: 'turnVel',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'avel',    init: 0 },
    { name: 'lookUp',     var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'horz',    init: 0 },
    { name: 'buttons',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'bits',    init: 0 },
    { name: 'extButtons', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'extbits', init: 0 },
    {
        name: 'motion',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: false,
        code: '',
        init: 0,
        object: [
            { name: 'forward', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'fvel', init: 0 },
            { name: 'strafe',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'svel', init: 0 },
            { name: 'turn',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'avel', init: 0 },
            { name: 'lookUp',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'horz', init: 0 },
        ]
    },
    { name: 'q16Avel', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'q16avel', init: 0 },
    { name: 'q16Horz', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: false, code: 'q16horz', init: 0 },
]

export const nativeVars_TileData: CON_NATIVE_VAR[] = [
    { name: 'xsize',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'xsize',      init: 0 },
    { name: 'ysize',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'ysize',      init: 0 },
    { name: 'xOffset',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'xoffset',    init: 0 },
    { name: 'yOffset',    var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'yoffset',    init: 0 },
    { name: 'animFrames', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'animframes', init: 0 },
    { name: 'animSpeed',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'animspeed',  init: 0 },
    { name: 'animType',   var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'animtype',   init: 0 },
    { name: 'gameFlags',  var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'gameflags',  init: 0 },
    { name: 'alpha',      var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'alpha',      init: 0 },
    {
        name: 'size',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: true,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'xsize', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'ysize', init: 0 },
        ]
    },
    {
        name: 'offset',
        var_type: CON_NATIVE_TYPE.object,
        type: CON_NATIVE_FLAGS.OBJECT,
        readonly: true,
        code: '',
        init: 0,
        object: [
            { name: 'x', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'xoffset', init: 0 },
            { name: 'y', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'yoffset', init: 0 },
        ]
    },
]

export const nativeVars_PalData: CON_NATIVE_VAR[] = [
    { name: 'noFloorPal', var_type: CON_NATIVE_TYPE.native, type: CON_NATIVE_FLAGS.VARIABLE, readonly: true, code: 'nofloorpal', init: 0 },
]

export const nativeVarsList = ['sprites', 'sectors', 'walls', 'projectiles',
    'players', 'tiledata', 'tsprites', 'paldata', 'userdef', 'input'];

export type pointer = void;

export function Label<pointer>(name: string): pointer {
    return name as pointer;
}

