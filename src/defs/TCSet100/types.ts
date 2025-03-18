import { CON_NATIVE, CON_NATIVE_POINTER } from "./native";

namespace nocompile {}

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

    export interface tag {
        lotag: CON_NATIVE<number>;
        hitag: CON_NATIVE<number>;
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
        public pos: CON_NATIVE<vec3>;

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

        protected Main(): void;

        protected Events: OnEvent;
    }

    export const sprites: CActor[];

    export type TEventPAE = 'Game' | 'EGS' | 'Spawn' | 'KillIt' | 'PreGame' | 'PreActorDamage' | 'AnimateSprites' | 'RecogSound';
    export type TEventDE = 'DisplayRest' | 'DisplayStart' | 'DisplayEnd';
    export type TEvents = TEventPAE | TEventDE;

    export type OnEvent = Partial<{
        [E in TEventPAE]: (
          this: CEvent & CActor
        ) => void | number;
    }>;

    export class CEvent {
        protected argument?: number | number[];

        constructor(event: TEvents)

        public RotateSprite(x: number, y: number, scale: number, ang: number, picnum: number, shade: number, pal: number, orientation: number, x0: number, y0: number, x1: number, y1: number): CON_NATIVE<void>;
        public DrawSprite(pos: pos2, picnum: number, style: style): CON_NATIVE<void>;
        public ScreenSound(sound: number): CON_NATIVE<void>;

        protected Append(): void | number;
        protected Prepend(): void | number;
    }

    export interface CSectorBase {
        z: CON_NATIVE<number>;
        picnum: CON_NATIVE<number>;
        slope: CON_NATIVE<number>;
        shade: CON_NATIVE<number>;
        pal: CON_NATIVE<number>;
        xPan: CON_NATIVE<number>;
        yPan: CON_NATIVE<number>;
        zGoal: CON_NATIVE<number>;
        bunch: CON_NATIVE<number>;
        stat: CON_NATIVE<number>;
    }

    export class CWall {
        public pos: CON_NATIVE<vec2>;
        public point2: CON_NATIVE<number>;

        public blend: CON_NATIVE<number>;

        public nextWall: CON_NATIVE<number>;
        public nextSector: CON_NATIVE<number>;

        public cstat: CON_NATIVE<number>;

        public picnum: CON_NATIVE<number>;
        public overpicnum: CON_NATIVE<number>;

        public shade: CON_NATIVE<number>;
        public pal: CON_NATIVE<number>;

        public texRepeat: CON_NATIVE<vec2>;
        public texPan: CON_NATIVE<vec2>;

        public tags: CON_NATIVE<tag>;

        public extra: CON_NATIVE<number>;
        public ang: CON_NATIVE<number>;

        public wallPoint2: CWall;
        public next: { wall: CWall, sector: CSector };
    }

    export class CSector {
        public wallPtr: CON_NATIVE<number>;
        public wallNum: CON_NATIVE<number>;
       
        public ceiling: CON_NATIVE<CSectorBase>;
        public floor: CON_NATIVE<CSectorBase>;

        public visibility: CON_NATIVE<number>;
        public fogPal: CON_NATIVE<number>;
        
        public tags: CON_NATIVE<tag>;

        public extra: CON_NATIVE<number>;

        public firstWall: CWall;
        public walls: CWall[];
    }

    export const sectors: CSector[];
}