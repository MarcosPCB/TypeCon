namespace noread {}

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
    code: string | ((args?: boolean, fn?: string) => string) | ((constants: string[]) => string),
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
            if(args == true)
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
        arguments_default: [ 4, 4, 1, 1]
    },
    {
        name: 'Count',
        code: ((args?: boolean) => {
            if(args == true)
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
            if(args == true)
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
            if(args == true)
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
        name: 'GetReference',
        code: (args: boolean) => {
            return `set rb r0\n`;
        },
        returns: true,
        return_type: 'array',
        arguments: [
            CON_NATIVE_FLAGS.VARIABLE
        ],
        object_belong: [ 'sysFrame' ]
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
        object_belong: [ 'sysFrame' ]
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
        object_belong: [ 'sysFrame' ]
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
    }
];

export const nativeVarsList = ['sprites', 'sectors', 'walls', 'projectiles',
    'players', 'tiledata', 'tsprites', 'paldata', 'userdef'];

export type pointer = void;

export function Label<pointer>(name: string): pointer {
    return name as pointer;
}

