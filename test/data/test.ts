import '../../src/defs/types';

type wow = {
    name: string,
    ball: number
}

class newEnemy extends CActor {

    constructor() {
        const action: IAction = {
            name: 'idle',
            start: 0,
            length: 3 + 4,
            viewType: 1,
            incValue: 1,
            delay: 4
        }

        const move: IMove = {
            name: 'walkvel',
            horizontal_vel: 64,
            vertical_vel: 0
        }

        const ai: IAi = {
            name: 'idle_ai',
            action: 'idle',
            move: 'walkvel',
            flags: EMoveFlags.seekplayer
        }

        super(1680, true, 100, [action], action, [move], [ai]);
    }

    Test(arg: number): number {
        arg += 2 + 2;
        return arg;
    }

    Main(): void {
        console.log(this.extra + 5);
        const test: number = 0;
        let go = 2 + test * 3;
        go -= test + 1;
        console.log(go);

        if(go == 2) {
            go = 6;
        }

        if(this.playerDist > 2048 && this.curAction == Label('idle')) {
            this.PlayAction(Label('idle'));
            this.Move(Label('walkvel'), EMoveFlags.faceplayerslow);
            this.CStat(2);
            console.log(this.CStat());
            return;
        }

        this.CStatOR(go);
        this.SizeTo(6, 6);
        this.SizeTo(6, 6, 2, 2);
        this.Glass(5);

        this.Test(go);

        this.Spawn(NewEnemy, (RETURN) => {
            sprites[RETURN].extra = 50;
        });

        let obj = {
            v: 1,
            g: 2,
            l: 3,
        }

        obj.g += 9;

        let arr = [3];
        arr[go] = 2;
        arr[sprites[go].picnum] = 3;
        go = arr[1];
        go = arr[sprites[go].extra];

        let you: wow[] = new Array(4);
    }
}

declare global {
    export const NewEnemy: newEnemy;
}