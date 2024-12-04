import { CON_NATIVE, CON_NATIVE_POINTER } from "./native";
declare global {
    export type TLabel = string; //Use this to define constants and pointers

    export type pointer = void;
    export function Label<pointer>(name: string): pointer;

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

    interface IEvent {
        value?: number | number[],
        Append(): number | number[] | void,
        Prepend(): number | number[] | void,
    }
    /*
    export class CEventEgs implements IEvent {
        public value: number;

        constructor(value: number) {
            this.value = value;
        }
    }
    */

    export class CActor {
        public isEnemy: boolean;
        public extra: CON_NATIVE<number>;
        public htExtra: CON_NATIVE<number>;
        public htPicnum: CON_NATIVE<number>;
        public curAction: CON_NATIVE_POINTER;
        public curMove: CON_NATIVE_POINTER;
        public curAI: CON_NATIVE_POINTER;
        public picnum: CON_NATIVE<number>;
        public playerDist: CON_NATIVE<number>;

        public index: number;

        private readonly actions: IAction[];
        private readonly moves: IMove[];
        private readonly ais: IAi[];
        public EventEgs: IEvent;

        constructor(
            picnum: number,
            isEnemy: boolean,
            extra?: number,
            actions?: IAction[],
            first_action?: IAction,
            moves?: IMove[],
            ais?: IAi[]
        )

        PlayAction(action: string): CON_NATIVE<void>
        Move(move: string, flags: number): CON_NATIVE<void>
        StartAI(ai: string): CON_NATIVE<void>
        CanSee(): CON_NATIVE<boolean>
        CanShootTarget(): CON_NATIVE<boolean>
        CStat(stats?: number): CON_NATIVE<number>
        CStatOR(stats: number): CON_NATIVE<void> 
        SizeAt(w: number, h: number): CON_NATIVE<void> 
        SizeTo(w: number, h: number, inc_x?: number, inc_y?: number): CON_NATIVE<void> 
        Count(value?: number): CON_NATIVE<number> 

        public Main(): void
    }
}