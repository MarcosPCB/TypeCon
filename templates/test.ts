import '../include/TCSet100/types';
import { DN3D } from '../include/TCSet100/DN3D/game.ts';

/**
 * Type definitions for testing
 */
type wow = {
    name: number,
    ball: number
}

type test = {
    name: number,
    god: number,
    low: wow[]
}

/**
 * This will generated the DISPLAYREST event in CON
 */
class displayRest extends CEvent {
    constructor() {
        /**
         * Here is where you define which event to generate.
         * It does not matter what's the class name
         */
        super('DisplayRest');
    }

    public Append(): void {
        /**
         * RotateSprite is only available in DISPLAY events
         */
        this.RotateSprite(160, 100, 65536, 0, 0, 0, 0, 0, 0, 0, 1024, 768);

        /**
         * pos2 is a TypeCON native object
         * It holds the xy position values, scale and angle.
         * Good for screen drawing.
         */
        const p: pos2 = {
            xy: {
                x: 160,
                y: 100
            },
            scale: 65536,
            ang: 0
        }

        /**
         * Here we are declaring variables that are initialized with some antive structures values
         * Also, you can do const sector = sectors[0];
         * Giving you the possibility to hold native structure pointers in local variables.
         */
        const t = sectors[0].ceiling.z
        const a = sectors[sectors[0].extra].walls[0].pos.x
        //console.log(t);
        //console.log(a);

        /**
         * Object literal declaration using a type alias
         */
        const obj: test = {
            name: 2,
            god: 15,
            /**
             * The array here is kept inside the stack
             */
            low: Array(4)
        }

        obj.low[0].ball = 50;
        obj.low[1].ball = 66;
        obj.low[2].ball = 68;
        obj.low[3].ball = 80;
        const y = obj.low[1].ball;

        /** 
         * These commands print values to the console using addlog
         */
        PrintValue(obj.low[1].ball);
        PrintValue(obj.low.length);

        /**
         * This will allocate a new array on the heap
         */
        const u: number[] = [];
        /**
         * Now it must realocate the array to fit another value
         * (since it's on the heap and the size is less than one PAGE, nothing happens)
         */
        u.push(3);
        PrintValue(u.length);
        PrintValue(u[0]);

        /**
         * This commands prints the entire stack and heap usage to the console and breaks the game
         * unless you're using a debug version of Eduke32
         */
        //PrintStackAndBreak();
    }
}

class Player extends CPlayer {

    constructor() {
        super(1405, DN3D.ENames.AMMO);
    }
    
    Main() {
        this.weaponSystem.ammoAmount[1] = 72;
        this.actor.extra = 100;
        this.actor.Flash();
    }
}