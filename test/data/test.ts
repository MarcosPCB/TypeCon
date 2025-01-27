import '../../src/defs/types';

type wow = {
    name: string,
    ball: number
}

class newEnemy extends CActor {

    constructor() {
        const AIdle: IAction = {
            name: 'idle',
            start: 0,
            length: 1,
            viewType: 5,
            incValue: 1,
            delay: 0
        }

        const AWalk: IAction = {
            name: 'walk',
            start: 5,
            length: 3,
            viewType: 5,
            incValue: 1,
            delay: 16
        }

        const MWalk: IMove = {
            name: 'walkvel',
            horizontal_vel: 64,
            vertical_vel: 0
        }

        const MStop: IMove = {
            name: 'stop',
            horizontal_vel: 0,
            vertical_vel: 0
        }

        const AIIdle: IAi = {
            name: 'idle_ai',
            action: 'idle',
            move: 'stop',
            flags: EMoveFlags.faceplayerslow
        }

        const AIWalk: IAi = {
            name: 'walk_ai',
            action: 'walk',
            move: 'walkvel',
            flags: EMoveFlags.seekplayer
        }

        super(1685, true, 100, [AIdle, AWalk], AIdle, [MStop, MWalk], [AIIdle, AIWalk]);
    }

    Idle() {
        if(this.CanSee()) {
            if(this.CanShootTarget()) {
                if(this.playerDist < 4096) {
                    if(this.Count() >= 16) {
                        this.Shoot(1625);
                        this.Count(0);
                    }
                } else {
                    this.StartAI(Label('walk_ai'));
                    return;
                }
            } else {
                this.StartAI(Label('walk_ai'));
                return;
            }
        }
        
        return;
    }

    Walk() {
        if(this.CanSee() && this.CanSeeTarget()) {
            if(this.playerDist < 4096) {
                this.StartAI(Label('idle_ai'));
                return;
            }
        }
    }

    Main(): void {
        this.Fall();
        this.CStat(257);
        if(this.curAI == 0) {
            this.StartAI(Label('walk_ai'));
            this.SizeAt(32, 34);
        }

        switch(this.curAI) {
            case Label('idle_ai'):
                this.Idle();
                break;

            case Label('walk_ai'):
                this.Walk();
                break;
        }

        if(this.HitByWeapon()) {
            this.Spawn(1620);

            if(this.IsDead())
                this.KillIt();
        }
    }
}

declare global {
    export const NewEnemy: newEnemy;
}