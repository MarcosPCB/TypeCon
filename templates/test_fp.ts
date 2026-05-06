import '../include/TCSet100/types';
import { DN3D } from '../include/TCSet100/DN3D/game.ts';

// ─── FP16 helper: linearly interpolate two screen positions ───────────────────
// Both params and return are FP16; passing a plain integer triggers shiftl coercion.
function lerpFP16(from: FP16, to: FP16, t: FP16): FP16 {
    let delta: FP16  = to - from;    // plain sub (no scale change)
    let scaled: FP16 = delta * t;    // mulscale rd rd ra 16
    return from + scaled;            // plain add
}

// ─── DisplayRest event: HUD drawing with FP arithmetic ────────────────────────
class DisplayRestFP extends CEvent {
    constructor() { super('DisplayRest'); }

    public Append(): void {

        // ── compile-time FP16 literals (decimal → integer at compile time) ──
        let zoom: FP16    = 1.5;   // 1.5  * 65536 = 98304   → set ra 98304
        let half: FP16    = 0.5;   // 0.5  * 65536 = 32768   → set ra 32768
        let quarter: FP16 = 0.25;  // 0.25 * 65536 = 16384   → set ra 16384

        // Screen centre in 16.16 fixed-point (rotatesprite x/y use 16.16 internally)
        let cx: FP16 = 160.0;  // 160 * 65536 = 10485760
        let cy: FP16 = 100.0;  // 100 * 65536 = 6553600

        // ── FP multiplication (mulscale) ────────────────────────────────────
        // mulscale rd rd ra 16  →  98304 * 32768 >> 16 = 49152  (0.75 in FP16)
        let halfZoom: FP16 = zoom * half;

        // ── FP division (divscale) ──────────────────────────────────────────
        // divscale rd rd ra 16  →  (98304 << 16) / 32768 = 196608  (3.0 in FP16)
        let doubleZoom: FP16 = zoom / half;

        // ── FP add/sub (plain add/sub — precision unchanged) ────────────────
        let zoomSum: FP16  = zoom + halfZoom;   // add rd ra  → 147456  (2.25)
        let zoomDiff: FP16 = zoom - quarter;    // sub rd ra  →  81920  (1.25)

        // ── nested FP expression: (zoom*half) + (doubleZoom*quarter) ────────
        // left  mulscale  → 49152   (0.75)      [rfx0 saves left result]
        // right mulscale  → 49152   (0.75)
        // add             → 98304   (1.50)
        let combined: FP16 = zoom * half + doubleZoom * quarter;

        // ── intToFP16: convert plain integer offset to FP16 (shiftl 16) ────
        // intToFP16(64) emits:  set rb r0 / shiftl rb 16  →  4194304 (64.0 in FP16)
        let offsetX: FP16 = intToFP16(64);

        // ── FP16 user function call — all args FP16, no coercion ────────────
        // lerpFP16(cx, cx+64px, 0.5)  →  cx + 32px  (linear interpolation)
        let lerpX: FP16 = lerpFP16(cx, cx + offsetX, half);

        // ── fp16ToInt: extract integer from FP result (shiftr 16) ───────────
        // fp16ToInt(zoom)      → set rb r0 / shiftr rb 16  →  1
        // fp16ToInt(halfZoom)  → 0  (0.75 truncated)
        // fp16ToInt(doubleZoom)→ 3
        let zoomInt: number    = fp16ToInt(zoom);
        let halfInt: number    = fp16ToInt(halfZoom);
        let doubleInt: number  = fp16ToInt(doubleZoom);

        // ── RotateSprite: x/y/z are 16.16 raw values — FP16 passes directly ─
        // No coercion: cx, cy, halfZoom are already the 16.16 integers that
        // rotatesprite expects. ang=0, tile=CROSSHAIR, pal/shade/stat=0, fullscreen.
        this.RotateSprite(cx, cy, halfZoom, 0, DN3D.ENames.SHIELD, 0, 0, 0, 0, 0, 1024, 768);

        // Double-zoom variant using divscale result
        this.RotateSprite(cx, cy, doubleZoom, 0, DN3D.ENames.SHIELD, 0, 0, 0, 0, 0, 1024, 768);

        // ── lerpFP16 with plain integer as first arg: triggers coercion ──────
        // 'from' param is FP16; passing integer 80 → warning + shiftl r0 16
        let intFrom: number = 80;
        let lerpCoerced: FP16 = lerpFP16(intFrom, cx, half);
    }
}
