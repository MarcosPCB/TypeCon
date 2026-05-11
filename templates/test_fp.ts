import '../include/TCSet100/types';
import { DN3D } from '../include/TCSet100/DN3D/game.ts';

// ─── FP16 helper: linearly interpolate two screen positions ───────────────────
function lerpFP16(from: FP16, to: FP16, t: FP16): FP16 {
    let delta: FP16  = to - from;    // plain sub
    let scaled: FP16 = delta * t;    // mulscale rd rd ra 16
    return from + scaled;            // plain add
}

// ─── DisplayRest event: HUD drawing with FP arithmetic ────────────────────────
class DisplayRestFP extends CEvent {
    constructor() { super('DisplayRest'); }

    public Append(): void {

        // ── FP16 literals ──────────────────────────────────────────────────
        let zoom: FP16    = 1.5;   // 98304
        let half: FP16    = 0.5;   // 32768
        let quarter: FP16 = 0.25;  // 16384

        // Screen centre in FP16
        let cx: FP16 = 160.0;  // 10485760
        let cy: FP16 = 100.0;  // 6553600

        PrintValue(fp16ToInt(zoom));    // expect 1
        PrintValue(fp16ToInt(half));    // expect 0
        PrintValue(fp16ToInt(quarter)); // expect 0
        PrintValue(fp16ToInt(cx));      // expect 160
        PrintValue(fp16ToInt(cy));      // expect 100

        // ── FP arithmetic ──────────────────────────────────────────────────
        let halfZoom: FP16   = zoom * half;      // 49152  (0.75)
        let doubleZoom: FP16 = zoom / half;      // 196608 (3.0)
        let zoomSum: FP16    = zoom + halfZoom;  // 147456 (2.25)
        let zoomDiff: FP16   = zoom - quarter;   // 81920  (1.25)
        let combined: FP16   = zoom * half + doubleZoom * quarter; // 98304 (1.5)

        PrintValue(halfZoom);    // expect 49152
        PrintValue(doubleZoom);  // expect 196608
        PrintValue(zoomSum);     // expect 147456
        PrintValue(zoomDiff);    // expect 81920
        PrintValue(combined);    // expect 98304

        // ── FP16 → integer conversions ─────────────────────────────────────
        let offsetX: FP16 = intToFP16(64);    // 4194304
        let lerpX: FP16   = lerpFP16(cx, cx + offsetX, half); // cx + 32px FP16

        let zoomInt:   number = fp16ToInt(zoom);      // 1
        let halfInt:   number = fp16ToInt(halfZoom);  // 0
        let doubleInt: number = fp16ToInt(doubleZoom);// 3

        PrintValue(offsetX);    // expect 4194304
        PrintValue(lerpX);      // expect cx + 32*65536
        PrintValue(zoomInt);    // expect 1
        PrintValue(halfInt);    // expect 0
        PrintValue(doubleInt);  // expect 3

        // ── RotateSprite: zoom param needs raw 16.16 bit pattern ───────────
        // fp16Raw() passes the raw integer without the shiftr 16 auto-cast
        this.RotateSprite(cx, cy, fp16Raw(halfZoom),   0, DN3D.ENames.SHIELD, 0, 0, 0, 0, 0, 1024, 768);
        this.RotateSprite(cx, cy, fp16Raw(doubleZoom), 0, DN3D.ENames.SHIELD, 0, 0, 0, 0, 0, 1024, 768);

        // ── lerpFP16 with plain integer arg triggers FP coercion warning ───
        let intFrom: number = 80;
        let lerpCoerced: FP16 = lerpFP16(intFrom, cx, half);
        PrintValue(lerpCoerced); // expect cx*half - 16px equivalent
    }
}
