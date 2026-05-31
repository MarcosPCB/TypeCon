import '../../../include/TCSet100/types';

class TestProjectiles extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        let i: number = 0;

        // ── flat fields ────────────────────────────────────────────────────
        let vel: number      = projectiles[i].vel;
        let velM: number     = projectiles[i].velMult;
        let bnc: number      = projectiles[i].bounces;
        let bSnd: number     = projectiles[i].bSound;
        let iSnd: number     = projectiles[i].iSound;
        let snd: number      = projectiles[i].sound;
        let rng: number      = projectiles[i].range;
        let drp: number      = projectiles[i].drop;
        let hitR: number     = projectiles[i].hitRadius;
        let off: number      = projectiles[i].offset;
        let trl: number      = projectiles[i].trail;
        let tnum: number     = projectiles[i].tnum;
        let tOff: number     = projectiles[i].tOffset;
        let txR: number      = projectiles[i].txRepeat;
        let tyR: number      = projectiles[i].tyRepeat;
        let sxR: number      = projectiles[i].sxRepeat;
        let syR: number      = projectiles[i].syRepeat;
        let shd: number      = projectiles[i].shade;
        let pal: number      = projectiles[i].pal;
        let cst: number      = projectiles[i].cstat;
        let clip: number     = projectiles[i].clipDist;
        let dcl: number      = projectiles[i].decal;
        let xtr: number      = projectiles[i].extra;
        let xtrR: number     = projectiles[i].extraRand;
        let ud: number       = projectiles[i].userdata;
        let fc: number       = projectiles[i].flashColor;
        let spw: number      = projectiles[i].spawns;
        let wl: number       = projectiles[i].worksLike;
        let xRep: number     = projectiles[i].xRepeat;
        let yRep: number     = projectiles[i].yRepeat;

        // ── grouped repeats ────────────────────────────────────────────────
        let trRepX: number   = projectiles[i].trailRepeat.x;
        let trRepY: number   = projectiles[i].trailRepeat.y;
        let spRepX: number   = projectiles[i].spriteRepeat.x;
        let spRepY: number   = projectiles[i].spriteRepeat.y;

        projectiles[i].trailRepeat.x  = 64;
        projectiles[i].trailRepeat.y  = 64;
        projectiles[i].spriteRepeat.x = 48;
        projectiles[i].spriteRepeat.y = 48;

        // ── physics sub-object ─────────────────────────────────────────────
        let pVel: number   = projectiles[i].physics.vel;
        let pMult: number  = projectiles[i].physics.velMult;
        let pDrop: number  = projectiles[i].physics.drop;
        let pRng: number   = projectiles[i].physics.range;
        let pBnc: number   = projectiles[i].physics.bounces;
        let pOff: number   = projectiles[i].physics.offset;
        let pClip: number  = projectiles[i].physics.clipDist;

        projectiles[i].physics.vel    = 512;
        projectiles[i].physics.drop   = 0;
        projectiles[i].physics.range  = 0;

        // ── audio sub-object ───────────────────────────────────────────────
        let aFire: number   = projectiles[i].audio.fire;
        let aBounce: number = projectiles[i].audio.bounce;
        let aImpact: number = projectiles[i].audio.impact;

        projectiles[i].audio.fire   = 0;
        projectiles[i].audio.bounce = 0;
        projectiles[i].audio.impact = 0;

        // ── trailConfig sub-object ─────────────────────────────────────────
        let tcEn: number   = projectiles[i].trailConfig.enabled;
        let tcSpr: number  = projectiles[i].trailConfig.sprite;
        let tcOff: number  = projectiles[i].trailConfig.offset;
        let tcTxR: number  = projectiles[i].trailConfig.txRepeat;
        let tcTyR: number  = projectiles[i].trailConfig.tyRepeat;
        let tcSxR: number  = projectiles[i].trailConfig.sxRepeat;
        let tcSyR: number  = projectiles[i].trailConfig.syRepeat;

        projectiles[i].trailConfig.enabled = 0;

        // ── appearance sub-object ──────────────────────────────────────────
        let aShd: number  = projectiles[i].appearance.shade;
        let aPal: number  = projectiles[i].appearance.pal;
        let aCst: number  = projectiles[i].appearance.cstat;
        let aXR: number   = projectiles[i].appearance.xRepeat;
        let aYR: number   = projectiles[i].appearance.yRepeat;

        projectiles[i].appearance.shade   = 0;
        projectiles[i].appearance.xRepeat = 48;
        projectiles[i].appearance.yRepeat = 48;

        // ── effect sub-object ──────────────────────────────────────────────
        let eHit: number  = projectiles[i].effect.hitRadius;
        let eDcl: number  = projectiles[i].effect.decal;
        let eFlash: number = projectiles[i].effect.flashColor;
        let eXtr: number  = projectiles[i].effect.extra;
        let eXtrR: number = projectiles[i].effect.extraRand;
        let eSpw: number  = projectiles[i].effect.spawns;

        projectiles[i].effect.hitRadius  = 0;
        projectiles[i].effect.flashColor = 0;

        console.log("test_projectiles OK");
    }
}
