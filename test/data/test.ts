import '../../include/TCSet100/types';

type wow = {
    name: number,
    ball: number
}

type test = {
    name: number,
    god: number,
    low: wow[]
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

        super(1685, true, 10, [AIdle, AWalk], AIdle, [MStop, MWalk], [AIIdle, AIWalk]);
    }

    Events: OnEvent = {
        EGS() {
            console.log(1);
        }
    }

    Idle() {
        const s = sprites;
        const s1 = sprites[0];

        s[0].ang = 56;
        console.log(sprites[0].ang);

        s1.ang = 57;
        console.log(sprites[0].ang);

        if(this.CanSee()) {
            if(this.CanShootTarget()) {
                if(this.playerDist < 4096) {
                    if(this.Count() >= 16) {
                        this.Shoot(Names.FIRELASER);
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

        console.log(2);

        if(this.HitByWeapon()) {
            this.Spawn(Names.BLOOD);

            this.Guts(Names.JIBS6, 2);

            if(this.IsDead())
                this.KillIt();
        }
    }
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

        this.DrawSprite(p, 1685, {
            shade: 0,
            pal: 21,
            orientation: 8
        });

        const t = sectors[0].ceiling.z
        const a = sectors[sectors[0].extra].walls[0].pos.x
        console.log(t);
        console.log(a);

        const obj: test = {
            name: 2,
            god: 15,
            low: Array(4)
        }

        const y = obj.low[1].ball;

        CON(`
qputs 9999 FUCK ME
quote 9999`);
    }
}