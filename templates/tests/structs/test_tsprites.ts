import '../../../include/TCSet100/types';

// tsprites are only valid during renderer events
class TestTSprites extends CEvent {
    constructor() { super('DisplayRest'); }
    public Append(): void {
        let i: number = 0;

        // ── position / velocity / repeat / offset (bundled) ───────────────
        let px: number = tsprites[i].pos.x;
        let py: number = tsprites[i].pos.y;
        let pz: number = tsprites[i].pos.z;

        let vx: number = tsprites[i].vel.x;
        let vy: number = tsprites[i].vel.y;
        let vz: number = tsprites[i].vel.z;

        let rx: number = tsprites[i].repeat.x;
        let ry: number = tsprites[i].repeat.y;

        let ox: number = tsprites[i].offset.x;
        let oy: number = tsprites[i].offset.y;

        // ── flat fields ────────────────────────────────────────────────────
        let ang: number     = tsprites[i].ang;
        let pic: number     = tsprites[i].picnum;
        let shd: number     = tsprites[i].shade;
        let pal: number     = tsprites[i].pal;
        let cst: number     = tsprites[i].cstat;
        let own: number     = tsprites[i].owner;
        let stat: number    = tsprites[i].statnum;
        let sect: number    = tsprites[i].sectnum;
        let xtr: number     = tsprites[i].extra;
        let clip: number    = tsprites[i].clipDist;
        let bld: number     = tsprites[i].blend;
        let lotag: number   = tsprites[i].tags.lotag;
        let hitag: number   = tsprites[i].tags.hitag;

        // writes (non-readonly)
        tsprites[i].pos.x     = px;
        tsprites[i].pos.y     = py;
        tsprites[i].ang       = ang;
        tsprites[i].picnum    = pic;
        tsprites[i].shade     = shd;
        tsprites[i].pal       = pal;
        tsprites[i].cstat     = cst;
        tsprites[i].repeat.x  = rx;
        tsprites[i].repeat.y  = ry;

        console.log("test_tsprites OK");
    }
}
