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

class newEnemy extends CActor {

    protected AIdle: IAction = {
        start: 0,
        length: 1,
        viewType: 5,
        incValue: 1,
        delay: 0
    }

    protected AWalk: IAction = {
        start: 5,
        length: 3,
        viewType: 5,
        incValue: 1,
        delay: 16
    }

    protected MWalk: IMove = {
        horizontal_vel: 64,
        vertical_vel: 0
    }

    protected MStop: IMove = {
        horizontal_vel: 0,
        vertical_vel: 0
    }

    protected AIIdle: IAi = {
        action: 'idle',
        move: 'stop',
        flags: EMoveFlags.faceplayerslow
    }

    protected AIWalk: IAi = {
        action: 'walk',
        move: 'walkvel',
        flags: EMoveFlags.seekplayer
    }


    constructor() {
        super(1685, true, 10);
    }

    Events: OnEvent = {
        EGS() {
            console.debug(1);
        }
    }

    Idle() {
        if(this.CanSee()) {
            if(this.CanShootTarget()) {
                if(this.playerDist < 4096) {
                    if(this.Count() >= 16) {
                        this.Shoot(DN3D.ENames.FIRELASER);
                        this.Count(0);
                    }
                } else {
                    this.StartAI(this.AIWalk);
                    return;
                }
            } else {
                this.StartAI(this.AIWalk);
                return;
            }
        }
        
        return;
    }

    Walk() {
        if(this.CanSee() && this.CanSeeTarget()) {
            if(this.playerDist < 4096) {
                this.StartAI(this.AIIdle);
                return;
            }
        }
    }

    Main(): void {
        this.Fall();
        this.CStat(257);
        if(this.curAI == null) {
            this.StartAI(this.AIWalk);
            this.SizeAt(32, 34);
        }

        switch(this.curAI) {
            case this.AIIdle:
                this.Idle();
                break;

            case this.AIWalk:
                this.Walk();
                break;
        }

        if(this.HitByWeapon()) {
            this.Spawn(DN3D.ENames.BLOOD, (e) => {
                console.debug('worked');
                console.debug(e);
            });

            this.Guts(DN3D.ENames.JIBS6, 2);

            if(this.IsDead()) {
                DN3D.states.TroopBodyJibs();
                const f = new CFile('test.txt');
                console.debug(1);
                f.Read(FileReadType.text, 8);
                const s = f.ReadString();

                if(s) {
                    console.debug(s);
                }
                this.KillIt();
            }
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

        const t = sectors[0].ceiling.z
        const a = sectors[sectors[0].extra].walls[0].pos.x
        //console.log(t);
        //console.log(a);

        const obj: test = {
            name: 2,
            god: 15,
            low: Array(4)
        }

        const y = obj.low[1].ball;
    }
}