import '../../src/defs/types';

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

        super(0, true, 100, [action], action, [move], [ai]);
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
        }

        this.CStatOR(go);
        this.SizeTo(6, 6);
        this.SizeTo(6, 6, 2, 2);
        this.Glass(5);

        this.Test(go);

        return;
    }
    
}