import { CON_NATIVE, CON_NATIVE_POINTER } from "./native";

declare global {
    export enum Names {
        APLAYER = 1405,
        BLOOD = 1620,
        FIRELASER = 1625,
        JIBS6 = 2286
    }

    export type vec2 = {
        x: number,
        y: number
    }

    export type vec3 = {
        x: number,
        y: number,
        z: number,
    }

    export type pos2 = {
        xy: vec2,
        scale: number,
        ang: number
    }

    export type pos3 = {
        xyz: vec3,
        ang: number
    }

    export type style = {
        shade: number,
        pal: number,
        orientation: number
    }

    export type TLabel = string; //Use this to define constants and pointers

    export interface pointer {}
    export function Label(name: string): pointer;
    export type constant = number;

    //Interface for declaring actions
    export interface IAction {
        name: TLabel,
        start: number,
        length: number,
        //Valid values are: 1, 3, 5, 7, 8
        viewType: number,
        incValue: number,
        /* 
        [0,3] is the minimum delay, equal to the tic counter.
        [4,7] is 1/2 of the tic counter delay
        [8,11] is 1/3 of the tic counter delay
        [12,15] is 1/4; [16,19] is 1/5; etc.
        */
        delay: number 
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

    export enum CON_NATIVE_TYPE {
        global = 1,
        actor = 2,
        player = 4,
        variable = 8
    }

    //Interface for declaring moves
    export interface IMove {
        name: TLabel,
        horizontal_vel: number,
        vertical_vel: number,
    }

    //Interface for declaring AI
    export interface IAi {
        name: TLabel,
        action: TLabel,
        move: TLabel,
        flags: EMoveFlags
    }

    export function Delete(buffer: any): void;
    export function Free(buffer: any): void;

    export class CActor {
        public picnum: CON_NATIVE<number>;
        public isEnemy: boolean;
        public extra: CON_NATIVE<number>;
        public htExtra: CON_NATIVE<number>;
        public damage: CON_NATIVE<number>;
        public htPicnum: CON_NATIVE<number>;
        public weaponHit: CON_NATIVE<number>;

        public playerDist: CON_NATIVE<number>;

        public curAction: CON_NATIVE_POINTER;
        public curActionFrame: CON_NATIVE<number>;

        public curMove: CON_NATIVE_POINTER;
        public vel: CON_NATIVE<number>;
        public ang: CON_NATIVE<number>;

        public curAI: CON_NATIVE_POINTER;

        protected index: number;

        constructor(
            picnum: number,
            isEnemy: boolean,
            extra?: number,
            actions?: IAction[],
            first_action?: IAction,
            moves?: IMove[],
            ais?: IAi[]
        )

        //Actor control
        protected PlayAction(action: pointer): CON_NATIVE<void>
        protected Move(move: pointer, flags: number): CON_NATIVE<void>
        protected StartAI(ai: pointer): CON_NATIVE<void>
        protected CStat(stats?: number): CON_NATIVE<number>
        protected CStatOR(stats: number): CON_NATIVE<void> 
        protected SizeAt(w: number, h: number): CON_NATIVE<void> 
        protected SizeTo(w: number, h: number, inc_x?: number, inc_y?: number): CON_NATIVE<void> 
        protected Count(value?: number): CON_NATIVE<number> 
        protected Fall(): CON_NATIVE<void>
        protected GetLastPal(): CON_NATIVE<void>
        protected KillIt(): CON_NATIVE<void>
        protected Stop(): CON_NATIVE<void>
        protected ResetAction(): CON_NATIVE<void>
        protected Spawn(picnum: number | CActor, initFn?: ((RETURN: number) => void), queued?: boolean): CON_NATIVE<number>
        protected Shoot(picnum: number | CActor, initFn?: ((RETURN: number) => void), use_zvel?: boolean, zvel?: number, additive_zvel?: boolean): CON_NATIVE<number>
        protected HitRadius(radius: number, furthestDmg: number, farDmg: number, closeDmg: number, closestDmg: number): CON_NATIVE<void>
        protected Flash(): CON_NATIVE<void>
        protected RespawnHitag(): CON_NATIVE<void>
        protected Operate(flags: EOperateFlags, lotag?: number, player_id?: number, sector?: number, sprite?: number): CON_NATIVE<void>

        //Conditionals
        protected IsAwayFromWall(): CON_NATIVE<boolean>
        protected IsInWater(): CON_NATIVE<boolean>
        protected IsOnWater(): CON_NATIVE<boolean>
        protected IsOutside(): CON_NATIVE<boolean>
        protected IsInSpace(): CON_NATIVE<boolean>
        protected IsInOuterSpace(): CON_NATIVE<boolean>
        protected IsRandom(value: constant): CON_NATIVE<boolean>
        protected IsDead(): CON_NATIVE<boolean>
        protected Squished(): CON_NATIVE<boolean>
        protected IsItMoving(): CON_NATIVE<boolean>
        protected BulletNear(): CON_NATIVE<boolean>
        protected HitByWeapon(): CON_NATIVE<boolean>
        protected CanSee(): CON_NATIVE<boolean>
        protected CanSeeTarget(): CON_NATIVE<boolean>
        protected CanShootTarget(): CON_NATIVE<boolean>
        protected PlayerHitSpace(): CON_NATIVE<boolean>
        protected WeaponHit(): CON_NATIVE<number>

        //Get values
        protected AngleToTarget(): CON_NATIVE<number>

        //Spawn misc
        protected Debris(tile: constant, amount: constant): CON_NATIVE<void>
        protected Guts(tile: constant, amount: constant): CON_NATIVE<void>
        protected Mail(amount: constant): CON_NATIVE<void>
        protected Money(amount: constant): CON_NATIVE<void>
        protected Paper(amount: constant): CON_NATIVE<void>
        protected Glass(amount: constant): CON_NATIVE<void>

        //Player actions (nothing to do with animation)
        protected AddKills(amount: constant): CON_NATIVE<void>
        protected PlayerKick(): CON_NATIVE<void>
        protected LockPlayer(time: number): CON_NATIVE<void>
        protected ResetPlayer(flags: number): CON_NATIVE<void>

        protected Main(): void
    }

    export const sprites: CActor[];

    export type TEventType = 'DisplayRest' | 'DisplayStart' | 'DisplayEnd' | 'Game' | 'Egs';

    export class CEvent {
        protected argument?: number | number[];
        public event: TEventType;

        constructor(
            event: TEventType
        )

        protected RotateSprite(x: number, y: number, ang: number, scale: number, picnum: number, shade: number, pal: number, orientation: number, x0: number, y0: number, x1: number, y1: number): CON_NATIVE<void>;
        protected DrawSprite(pos: vec2, ang: number, scale: number, picnum: number, style: style, x0y0: vec2, x1y1: vec2): CON_NATIVE<void>;
        protected ScreenSound(sound: number): CON_NATIVE<void>;

        public Append(): void;
        public Prepend(): number | number[];
    }
}