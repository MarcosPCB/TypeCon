import '../../src/sets/TCSet100/types';
import DN3D from '../../include/TCSet100/DN3D/game';
import { CFile, FileReadType } from '../../src/sets/TCSet100/CFile';

type wow = {
    name: number,
    ball: number
}

type test = {
    name: number,
    god: number,
    low: wow[]
}

class displayRest extends CEvent {
    constructor() {
        super('DisplayRest');
    }

    public Append(): void {
        this.RotateSprite(160, 100, 65536, 0, 0, 0, 0, 0, 0, 0, 1024, 768);
        const p: pos2 = {
            xy: {
                x: 160,
                y: 100
            },
            scale: 65536,
            ang: 0
        }

        const t = sectors[0].ceiling.z
        const a = sectors[sectors[0].extra].walls[0].pos.x
        //console.log(t);
        //console.log(a);

        const obj: test = {
            name: 2,
            god: 15,
            low: Array(4)
        }

        obj.low[0].ball = 50;
        obj.low[1].ball = 66;
        obj.low[2].ball = 68;
        obj.low[3].ball = 80;
        const y = obj.low[1].ball;

        PrintValue(obj.low[1].ball);
        PrintValue(obj.low.length);

        const u = [];
        u.push(3);
        PrintValue(u.length);
        PrintValue(u[0]);

        PrintStackAndBreak();
    }
}