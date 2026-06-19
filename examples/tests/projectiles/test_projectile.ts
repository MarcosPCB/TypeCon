import '../../../include/TCSet100/types';

// Sprite-based projectile with actions, moves, and custom property
class TestRocket extends CProjectile {
    protected actions: TAction<'fly'> = {
        fly: { start: 0, length: 1, viewType: 1, incValue: 1, delay: 1 }
    };
    protected moves: TMove<'drift'> = {
        drift: { horizontal_vel: 0, vertical_vel: 0 }
    };

    hitCount: number = 0;

    constructor() {
        super(2520);    // RPG tile
        this.vel = 600;
        this.extra = 50;
        this.hitRadius = 2048;
        this.spawns = 1890;
        this.iSound = 24;
    }

    Main(first_action: IAction = this.actions.fly): void {
        if (this.HitByWeapon()) {
            this.KillIt();
        }
    }
}

// Hitscan projectile — no Main(), only defineprojectile emitted
class TestHitscan extends CProjectile {
    constructor() {
        super(2536);    // SHOTSPARK1 tile
        this.vel = 600;
        this.extra = 14;
        this.shade = -96;
    }
}
