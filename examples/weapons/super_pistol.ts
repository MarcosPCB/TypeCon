import '../../include/TCSet100/types';
import { CWeapon, TWeaponAnim } from '../../include/TCSet100/nws';
import DN3D from '../../include/TCSet100/DN3D/game';

class SuperPistol extends CWeapon {
    constructor() {
        super(
            1,
            0,
            {
                startFrame: DN3D.ENames.FIRSTGUN,
                duration: 5,
                fireDelay: 2,
                fireSoundTime: 2,
                fireSound: DN3D.ESound.PISTOL_FIRE,
                drawWeaponDuration: 10,
                drawWeaponSound: 0,
            } as TWeaponAnim,
            DN3D.ENames.SHOTSPARK1,
            {
                xy: {
                    x: 150.0,
                    y: 200.0
                },
                scale: 1.0,
                ang: 0.0
            },
            {
                shade: 0,
                pal: 0,
                orientation: 0
            },
            {
                lower: {
                    xy: {
                        x: 0,
                        y: 50.0
                    },
                    scale: 0.0,
                    ang: 0.0
                },
                offset: {
                    xy: {
                        x: 0,
                        y: 0.0
                    },
                    scale: 0.0,
                    ang: 0.0
                },
            }
        )
    }

    public override OnDraw(): void {
        FastSwitch([
            {
                values: [0],
                code: () => {
                    this.anim.curFrame = this.anim.startFrame;
                }
            },
            {
                values: [1],
                code: () => {
                    this.anim.curFrame++;
                }
            },
            {
                range: {
                    start: 2,
                    end: 5,
                },
                code: () => {
                    if(this.counter % 2 == 0)
                    this.anim.curFrame++;
                }
            }
        ], this.counter);
    }
}