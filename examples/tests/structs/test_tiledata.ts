import '../../../include/TCSet100/types';

class TestTileData extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        let i: number = 0;

        // ── flat fields (all readonly) ─────────────────────────────────────
        let xs: number   = tiledata[i].xsize;
        let ys: number   = tiledata[i].ysize;
        let xo: number   = tiledata[i].xOffset;
        let yo: number   = tiledata[i].yOffset;
        let af: number   = tiledata[i].animFrames;
        let asp: number  = tiledata[i].animSpeed;
        let at: number   = tiledata[i].animType;
        let gf: number   = tiledata[i].gameFlags;
        let al: number   = tiledata[i].alpha;

        // ── size sub-object ────────────────────────────────────────────────
        let szX: number  = tiledata[i].size.x;
        let szY: number  = tiledata[i].size.y;

        // ── offset sub-object ──────────────────────────────────────────────
        let offX: number = tiledata[i].offset.x;
        let offY: number = tiledata[i].offset.y;

        console.log("test_tiledata OK");
    }
}
