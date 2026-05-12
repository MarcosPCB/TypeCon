import '../include/TCSet100/types';
import { DN3D } from '../include/TCSet100/DN3D/game.ts';

// ─── FP16 helper: linearly interpolate two screen positions ───────────────────
function lerpFP16(from: FP16, to: FP16, t: FP16): FP16 {
    let delta: FP16 = to - from;
    let scaled: FP16 = delta * t;
    return from + scaled;
}

// ─── DisplayRest: only rotatesprite calls, viewport-relative ─────────────────
class DisplayRestFP extends CEvent {
    constructor() { super('DisplayRest'); }

    public Append(): void {
        let cx: FP16 = 160.0;
        let cy: FP16 = 100.0;
        let halfZoom: FP16 = 49152;
        let doubleZoom: FP16 = 196608;

        this.RotateSprite(cx, cy, fp16Raw(halfZoom), 0, DN3D.ENames.SHIELD, 0, 0, 0, 0, 0, xDim, yDim);
        this.RotateSprite(cx, cy, fp16Raw(doubleZoom), 0, DN3D.ENames.SHIELD, 0, 0, 0, 0, 0, xDim, yDim);
    }
}

// ─── InitComplete: full FP test suite ────────────────────────────────────────
class TestFP extends CEvent {
    constructor() { super('InitComplete'); }

    public Append(): void {
        let zoom: FP16 = 1.5;    // 98304
        let half: FP16 = 0.5;    // 32768
        let quarter: FP16 = 0.25;   // 16384
        let cx: FP16 = 160.0;  // 10485760
        let cy: FP16 = 100.0;  // 6553600

        // ── int-part extraction ───────────────────────────────────────────
        checkEq("fp16ToInt(zoom)", 1, fp16ToInt(zoom));
        checkEq("fp16ToInt(half)", 0, fp16ToInt(half));
        checkEq("fp16ToInt(quarter)", 0, fp16ToInt(quarter));
        checkEq("fp16ToInt(cx)", 160, fp16ToInt(cx));
        checkEq("fp16ToInt(cy)", 100, fp16ToInt(cy));

        // ── FP arithmetic ─────────────────────────────────────────────────
        let halfZoom: FP16 = zoom * half;
        let doubleZoom: FP16 = zoom / half;
        let zoomSum: FP16 = zoom + halfZoom;
        let zoomDiff: FP16 = zoom - quarter;
        let combined: FP16 = zoom * half + doubleZoom * quarter;

        checkFpEq("zoom*half", 49152, halfZoom);
        checkFpEq("zoom/half", 196608, doubleZoom);
        checkFpEq("zoom+halfZoom", 147456, zoomSum);
        checkFpEq("zoom-quarter", 81920, zoomDiff);
        checkFpEq("zoom*half+dbl*qtr", 98304, combined);

        // ── lerpFP16 ──────────────────────────────────────────────────────
        let offsetX: FP16 = intToFP16(64);
        let lerpX: FP16 = lerpFP16(cx, cx + offsetX, half);

        checkFpEq("intToFP16(64)", 4194304, offsetX);
        checkFpEq("lerpX", 12582912, lerpX);

        // ── FP → int conversions ──────────────────────────────────────────
        checkEq("fp16ToInt(zoom)", 1, fp16ToInt(zoom));
        checkEq("fp16ToInt(halfZoom)", 0, fp16ToInt(halfZoom));
        checkEq("fp16ToInt(dblZoom)", 3, fp16ToInt(doubleZoom));

        // ── fp16ToString + fp16FromString round-trip ──────────────────────
        let s1: string = fp16ToString(zoom);
        let s2: string = fp16ToString(half);
        let s3: string = fp16ToString(cx);

        checkFpEq("fp16FromString(zoom)", 98304, fp16FromString(s1));
        checkFpEq("fp16FromString(half)", 32768, fp16FromString(s2));
        checkFpEq("fp16FromString(cx)", 10485760, fp16FromString(s3));

        // ── FP auto-conversion in string concat ───────────────────────────
        // zoom/half/cx are FP16 — the + operator should call _convertFP2String
        let msg1: string = "zoom=" + zoom;
        let msg2: string = "half=" + half;
        let msg3: string = "cx=" + cx + " cy=" + cy;
        console.log(msg1);
        console.log(msg2);
        console.log(msg3);
    }
}
