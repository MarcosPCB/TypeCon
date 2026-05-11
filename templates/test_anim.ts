import '../include/TCSet100/types';
import { AnimUtils } from '../include/TCSet100/AnimUtils';

class TestAnim extends CEvent {
    constructor() { super('InitComplete'); }
    public Append(): void {
        let t: FP16 = 0.5;   // 32768
        let a: FP16 = 0.0;   // 0
        let b: FP16 = 1.0;   // 65536

        // ── Interpolation ─────────────────────────────────────────────────
        checkFpEq("lerp(0,1,0.5)", 32768, AnimUtils.lerp(a, b, t));

        // ── Smooth steps ─────────────────────────────────────────────────
        checkFpEq("smoothstep(0.5)",    32768, AnimUtils.smoothstep(t));
        checkFpEq("smootherstep(0.5)",  32768, AnimUtils.smootherstep(t));

        // ── Quadratic ease ────────────────────────────────────────────────
        checkFpEq("easeInQuad(0.5)",    16384, AnimUtils.easeInQuad(t));
        checkFpEq("easeOutQuad(0.5)",   49152, AnimUtils.easeOutQuad(t));
        checkFpEq("easeInOutQuad(0.5)", 32768, AnimUtils.easeInOutQuad(t));

        // ── Cubic ease ────────────────────────────────────────────────────
        checkFpEq("easeInCubic(0.5)",   8192,  AnimUtils.easeInCubic(t));
        checkFpEq("easeOutCubic(0.5)",  57344, AnimUtils.easeOutCubic(t));

        // ── Quintic ease ──────────────────────────────────────────────────
        checkFpEq("easeInQuint(0.5)",   2048,  AnimUtils.easeInQuint(t));
        checkFpEq("easeOutQuint(0.5)",  63488, AnimUtils.easeOutQuint(t));

        // ── Sine ease (BAM-based, ~1 BAM precision) ───────────────────────
        checkFpEq("easeInSine(0.5)",    17471, AnimUtils.easeInSine(t));
        checkFpEq("easeOutSine(0.5)",   48064, AnimUtils.easeOutSine(t));
        checkFpEq("easeInOutSine(0.5)", 32768, AnimUtils.easeInOutSine(t));

        // ── Power ease ────────────────────────────────────────────────────
        checkFpEq("easeInPow(0.5,4)",   4096,  AnimUtils.easeInPow(t, 4));
        checkFpEq("easeOutPow(0.5,4)",  61440, AnimUtils.easeOutPow(t, 4));

        // ── Bezier quadratic ──────────────────────────────────────────────
        checkFpEq("bezierQuad(0,1,1,0.5)", 49152, AnimUtils.bezierQuad(a, b, b, t));

        // ── Oscillation ───────────────────────────────────────────────────
        checkEq("pingPong(100,60)",       40, AnimUtils.pingPong(100, 60));
        checkFpEq("oscillateFP(100,60)", 43690, AnimUtils.oscillateFP(100, 60));

        // ── Utilities ─────────────────────────────────────────────────────
        checkEq("approach(20,100,5)", 25, AnimUtils.approach(20, 100, 5));
        checkEq("pulse(100,60,20)",    0, AnimUtils.pulse(100, 60, 20));
    }
}
