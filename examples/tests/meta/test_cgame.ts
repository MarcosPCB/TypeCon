import '../../../include/TCSet100/types';
import DN3D from '../../../include/TCSet100/DN3D/game';

// ── GameLabels used in CGame/CVolume ────────────────────────────────────────
const TILE_SKY: GameLabel     = DN3D.ENames.NUKEBARREL;   // placeholder sky tile
const TILE_WATER: GameLabel   = 686;                      // water tile

// ── CGame ────────────────────────────────────────────────────────────────────
// Emits: setgamename, defineskillname (×4), gamestartup, precache (×2), definecheat
class MyGame extends CGame {
    constructor() {
        super("My Total Conversion");

        this.skill(0, "Piece Of Cake");
        this.skill(1, "Let's Rock");
        this.skill(2, "Come Get Some");
        this.skill(3, "Damn I'm Good");

        this.startup({
            maxHealth:        100,  maxArmor:         100,
            maxSteroids:      400,  maxHoloduke:     1600,
            maxJetpack:      1600,  maxScuba:        6400,
            maxBoots:         200,  maxFirstAid:        6,
            initialHealth:    100,  initialArmor:       0,
            maxAmmoPistol:    200,  maxAmmoShotgun:    50,
            maxAmmoChaingun:  500,  maxAmmoRPG:        50,
            maxAmmoShrinker:   50,  maxAmmoDevastator: 50,
            maxAmmoLaser:     200,  maxAmmoFreeze:    200,
            maxAmmoShrunk:      0,  maxAmmoHeat:      100,
            maxAmmoExpander:   50,
            damagePistol:      14,  damageShotgun:    143,
            damageChaingun:    17,  damageRPG:        120,
            damageMortar:      90,  damageGrenade:    140,
        });

        // precache(external, startTile, endTile)
        // external=false → internal tiles; external=true → external art file
        this.precache(false, TILE_WATER, TILE_WATER);
        this.precache(false, TILE_SKY,   TILE_SKY);

        this.cheat('dnkroz', TILE_WATER);
    }
}

// ── CVolume ──────────────────────────────────────────────────────────────────
// Emits: definevolumename, definelevelname (×3), music (×2)
class Episode1 extends CVolume {
    constructor() {
        super(0, "L.A. Meltdown");

        // level(id, mapFile, musicFile, displayName, parTime?, designerTime?)
        this.level(1, "e1l1.map", "dethtoll.mid", "Hollywood Holocaust", 150, 90);
        this.level(2, "e1l2.map", "helter.mid",   "Red Light District",  120, 70);
        this.level(3, "e1l3.map", "lastlevel.mid","Death Row",           180, 100);

        // music(levelId, musicFile)
        this.music(1, "dethtoll.mid");
        this.music(2, "helter.mid");
    }
}

class Episode2 extends CVolume {
    constructor() {
        super(1, "Lunar Apocalypse");

        this.level(1, "e2l1.map", "moodyb.mid", "Staging Area", 90, 60);
        this.level(2, "e2l2.map", "watrwld1.mid", "Rusty Nails", 100, 65);
    }
}
