import DN3D from './DN3D/game';
import { CON_FUNC_ALIAS } from './native';
import './types';
import { AnimUtils } from './AnimUtils';

/**
 * @file NewWeapon.ts
 * @experimental This is experimental code and may be removed or changed without warning
 * @todo This code is not finished yet
 */

// This will be the new weapon system

//First disable the selection keys

// Bit field for weapon slot and sub activation -> 3 means both sub slots are enabld
const weaponSlotSub: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

class CWK1 extends CEvent {
    constructor() {
        super('WeapKey1')
    }

    Prepend() {
        if(weaponSlotSub[0] & 1)
            returnVar = -1;
    }
}

class CWK2 extends CEvent {
    constructor() {
        super('WeapKey2')
    }

    Prepend() {
        if(weaponSlotSub[1] & 1)
            returnVar = -1;
    }
}

class CWK3 extends CEvent {
    constructor() {
        super('WeapKey3')
    }

    Prepend() {
        if(weaponSlotSub[2] & 1)
            returnVar = -1;
    }
}

class CWK4 extends CEvent {
    constructor() {
        super('WeapKey4')
    }

    Prepend() {
        if(weaponSlotSub[3] & 1)
            returnVar = -1;
    }
}

class CWK5 extends CEvent {
    constructor() {
        super('WeapKey5')
    }

    Prepend() {
        if(weaponSlotSub[4] & 1)
            returnVar = -1;
    }
}

class CWK6 extends CEvent {
    constructor() {
        super('WeapKey6')
    }

    Prepend() {
        if(weaponSlotSub[5] & 1)
            returnVar = -1;
    }
}

class CWK7 extends CEvent {
    constructor() {
        super('WeapKey7')
    }

    Prepend() {
        if(weaponSlotSub[6] & 1)
            returnVar = -1;
    }
}

class CWK8 extends CEvent {
    constructor() {
        super('WeapKey8')
    }

    Prepend() {
        if(weaponSlotSub[7] & 1)
            returnVar = -1;
    }
}

class CWK9 extends CEvent {
    constructor() {
        super('WeapKey9')
    }

    Prepend() {
        if(weaponSlotSub[8] & 1)
            returnVar = -1;
    }
}

class CWK10 extends CEvent {
    constructor() {
        super('WeapKey10')
    }

    Prepend() {
        if(weaponSlotSub[9] & 1)
            returnVar = -1;
    }
}

export type TWeaponAnim = {
    startFrame: number;
    curFrame: number;
    /** Total frames */
    duration: number;
    /** In frames */
    fireDelay: number;
    /** In frames */
    fireSoundTime: number;
    /** In frames */
    fireSound: Sound | number;

    /** Duration in ticks */
    drawWeaponDuration: number;
    /** Sound used during draw animation */
    drawWeaponSound: Sound | number;
}

export type TWeaponOffset = {
    /** Used for controlling weapon positioning when the weapon is raised */
    offset?: pos2f;
    /** Used for controlling weapon positioning when lowering the weapon */
    lower: pos2f;
}

export class CWeapon {
    public slot: number;
    public sub: number;
    public anim: TWeaponAnim;
    public config: pos2f;
    public style: TStyle;
    public projectile: CProjectile | number;
    public counter: number;
    public drawCounter: number;

    protected offsets: TWeaponOffset;
    public curOffset: pos2f;

    protected canFire: boolean;
    protected hasFired: boolean;
    private active: boolean;

    private RotateSpriteF: CON_FUNC_ALIAS<typeof CEvent.prototype.RotateSpriteF> = CEvent.prototype.RotateSpriteF;

    constructor(
        slot: number,
        sub: number,
        anim: TWeaponAnim,
        projectile: CProjectile | number,
        config: pos2f,
        style: TStyle,
        offset?: TWeaponOffset
    ) {
        weaponSlotSub[slot] |= (sub + 1);

        this.slot = slot;
        this.sub = sub;
        this.anim = anim;
        this.projectile = projectile;
        this.anim.curFrame = this.anim.startFrame;
        this.counter = 0;
        this.config = config;
        this.style = style;
        this.offsets = offset ?? {
            offset: {
                xy: {
                    x: 0,
                    y: 0
                },
                scale: 0,
                ang: 0
            }, lower: {
                xy: {
                    x: 0,
                    y: 32.0
                },
                scale: 0,
                ang: 0
            }
        };

        this.curOffset.xy.x = this.offsets.lower.xy.x;
        this.curOffset.xy.y = this.offsets.lower.xy.y;
        this.curOffset.scale = this.offsets.lower.scale;
        this.curOffset.ang = this.offsets.lower.ang;

        this.drawCounter = 0;
    }

    protected OnDraw(): void {
        const cases: IFastSwitch[] = [
            {
                values: [0],
                code: () => {
                    this.anim.curFrame = this.anim.startFrame;
                }
            },   
        ]

        FastSwitch(cases, this.counter);
    }

    private Show() {
        if(!this.active) {
            player.weaponSystem.currWeapon = this.slot;
            player.weaponSystem.bSubWeapon[this.slot] = this.sub;

            if(this.drawCounter > 0) {
                this.drawCounter--;
                const step: FP16 = this.offsets.lower.xy.y / FP16(this.anim.drawWeaponDuration);

                this.curOffset.xy.y -= step;
                const end: FP16 = this.offsets.offset.xy.y + this.offsets.lower.xy.y

                const y: FP16 = AnimUtils.smoothstep(this.curOffset.xy.y / end);

                const final: FP16 = end * y;
                this.curOffset.xy.y = final;
            } else {
                this.active = true;
                this.curOffset.xy.y = this.offsets.offset.xy.y;
                this.canFire = true;
            }
        }
    }

    private Hide() {
        if(this.active) {
            if(this.drawCounter < this.anim.drawWeaponDuration) {
                this.drawCounter++;
                const step: FP16 = this.offsets.lower.xy.y / FP16(this.anim.drawWeaponDuration);

                this.curOffset.xy.y -= step;
                const end: FP16 = this.offsets.offset.xy.y + this.offsets.lower.xy.y

                const y: FP16 = AnimUtils.smoothstep(this.curOffset.xy.y / end);

                const final: FP16 = end * y;
                this.curOffset.xy.y = final;
            } else {
                this.active = false;
                this.curOffset.xy.y = this.offsets.lower.xy.y;
                this.canFire = false;
            }
        }
    }

    Events: OnEvent = {
        Fire: () => {
            if(weaponSlotSub[player.weaponSystem.currWeapon]
                & (player.weaponSystem.bSubWeapon[this.slot] + 1)) {
                returnVar = -1;

                if(this.counter == 0)
                    this.counter = 1;
            }
        },
        DoFire: () => {
            if(weaponSlotSub[player.weaponSystem.currWeapon]
                & (player.weaponSystem.bSubWeapon[this.slot] + 1)) {
                returnVar = -1;
            }
        },
        Game: () => {
            const a: CActor = sprites[thisActor];

            // Execute on the player instance
            if(a.picnum == DN3D.ENames.APLAYER) {
                if(this.counter > 0) {
                    this.counter++;
                    if(this.counter > this.anim.duration)
                        this.counter = 0;
                }
            }
        },
        DrawWeapon: () => {
            if(weaponSlotSub[player.weaponSystem.currWeapon]
                & (player.weaponSystem.bSubWeapon[this.slot] + 1)) {
                returnVar = -1;
                this.OnDraw();
                this.RotateSpriteF(
                    this.config.xy.x - this.curOffset.xy.x,
                    this.config.xy.y - this.curOffset.xy.y,
                    this.config.scale - this.curOffset.scale,
                    this.config.ang - this.curOffset.ang,
                    this.anim.curFrame,
                    this.style.shade,
                    this.style.pal,
                    this.style.orientation,
                    0, 0, xDim, yDim
                );
            }
        },
        WeapKey2: () => {
            if(weaponSlotSub[player.weaponSystem.currWeapon]
                & (player.weaponSystem.bSubWeapon[this.slot] + 1)
            ) {
                returnVar = -1;
                this.Show();
            }
        }
    }
}






