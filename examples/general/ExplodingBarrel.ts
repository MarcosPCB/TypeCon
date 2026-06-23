import '../../include/TCSet100/types';
import DN3D from '../../include/TCSet100/DN3D/game';

// ── Game identity ─────────────────────────────────────────────────────────────
class BarrelMod extends CGame {
    constructor() {
        super("Barrel Test");
        this.skill(0, "Easy");
        this.skill(1, "Normal");
        this.skill(2, "Hard");
        this.startup({
            maxHealth: 100, maxArmor: 100,
            maxSteroids: 400, maxHoloduke: 1600, maxJetpack: 1600,
            maxScuba: 6400, maxBoots: 200, maxFirstAid: 6,
            initialHealth: 100, initialArmor: 0,
            maxAmmoPistol: 200, maxAmmoShotgun: 50, maxAmmoChaingun: 500,
            maxAmmoRPG: 50, maxAmmoShrinker: 50, maxAmmoDevastator: 50,
            maxAmmoLaser: 200, maxAmmoFreeze: 200, maxAmmoShrunk: 0,
            maxAmmoHeat: 100, maxAmmoExpander: 50,
            damagePistol: 14, damageShotgun: 143, damageChaingun: 17,
            damageRPG: 120, damageMortar: 90, damageGrenade: 140,
        });
    }
}

// ── Tile labels ───────────────────────────────────────────────────────────────
// Using GameLabel keeps the names readable in the compiled .con output.
const TILE_NUKEBARREL:  GameLabel = DN3D.ENames.NUKEBARREL;   // 1227
const TILE_EXPLOSION2:  GameLabel = DN3D.ENames.EXPLOSION2;   // 1890

// ── Sound definitions ─────────────────────────────────────────────────────────
// BARREL_BOOM is auto-assigned to the first available sound slot (default 0).
// Emits:
//   define BARREL_BOOM 0
//   definesound BARREL_BOOM "barrel_boom.wav" -100 100 0 900 220
const BARREL_BOOM: Sound = {
    file: 'barrel_boom.wav',
    pitchMin: -100,
    pitchMax:  100,
    dist: 900,
    vol: 220,
};

// ── Actor ─────────────────────────────────────────────────────────────────────
class ExplodingBarrel extends CActor {
    protected readonly actions: TAction<'aIdle' | 'aDead'> = {
        aIdle: { start: 0, length: 1, viewType: 1, incValue: 0, delay: 0 },
        aDead: { start: 1, length: 1, viewType: 1, incValue: 0, delay: 0 },
    };

    constructor() {
        // picnum = TILE_NUKEBARREL (label name emitted in useractor header)
        // extra  = 20 hp
        super(TILE_NUKEBARREL, false, 20);
    }

    public main(first_action = this.actions.aIdle): void {
        this.Fall();

        if (this.IsDead()) {
            // Play the explosion boom globally so it is audible anywhere
            this.Sound(BARREL_BOOM);

            // Spawn the visual explosion sprite
            this.Spawn(TILE_EXPLOSION2);

            // Remove this sprite
            this.KillIt();
            return;
        }
    }
}
