import './types';

export namespace AnimUtils {

    // ── Interpolation ─────────────────────────────────────────────────────────

    export function lerp(a: FP16, b: FP16, t: FP16): FP16 {
        let diff: FP16 = b - a;
        return a + diff * t;
    }

    // ── Smooth steps ──────────────────────────────────────────────────────────

    // 3t²-2t³
    export function smoothstep(t: FP16): FP16 {
        let t2: FP16 = t * t;
        let t3: FP16 = t2 * t;
        let THREE: FP16 = intToFP16(3);
        let TWO: FP16 = 2.0;
        return THREE * t2 - TWO * t3;
    }

    // 6t⁵-15t⁴+10t³
    export function smootherstep(t: FP16): FP16 {
        let t2: FP16 = t * t;
        let t3: FP16 = t2 * t;
        let t4: FP16 = t3 * t;
        let t5: FP16 = t4 * t;
        let SIX: FP16 = intToFP16(6);
        let FIFTEEN: FP16 = intToFP16(15);
        let TEN: FP16 = intToFP16(10);
        return SIX * t5 - FIFTEEN * t4 + TEN * t3;
    }

    // ── Quadratic ease ────────────────────────────────────────────────────────

    export function easeInQuad(t: FP16): FP16 {
        return t * t;
    }

    export function easeOutQuad(t: FP16): FP16 {
        let ONE: FP16 = 1.0;
        let inv: FP16 = ONE - t;
        return ONE - inv * inv;
    }

    export function easeInOutQuad(t: FP16): FP16 {
        let ONE: FP16 = 1.0;
        let HALF: FP16 = 0.5;
        let TWO: FP16 = 2.0;
        let result: FP16 = 0.0;
        if (t < HALF) {
            result = TWO * t * t;
        } else {
            let comp: FP16 = ONE - t;
            result = ONE - TWO * comp * comp;
        }
        return result;
    }

    // ── Cubic ease ────────────────────────────────────────────────────────────

    export function easeInCubic(t: FP16): FP16 {
        let t2: FP16 = t * t;
        return t2 * t;
    }

    export function easeOutCubic(t: FP16): FP16 {
        let ONE: FP16 = 1.0;
        let inv: FP16 = ONE - t;
        let inv2: FP16 = inv * inv;
        return ONE - inv2 * inv;
    }

    // ── Quintic ease ──────────────────────────────────────────────────────────

    export function easeInQuint(t: FP16): FP16 {
        let t2: FP16 = t * t;
        let t4: FP16 = t2 * t2;
        return t4 * t;
    }

    export function easeOutQuint(t: FP16): FP16 {
        let ONE: FP16 = 1.0;
        let inv: FP16 = ONE - t;
        let inv2: FP16 = inv * inv;
        let inv4: FP16 = inv2 * inv2;
        return ONE - inv4 * inv;
    }

    // ── Sine ease — BAM quarter turn = t_raw/128; half turn = t_raw/64 ────────

    // 1 - cos(t*π/2)
    export function easeInSine(t: FP16): FP16 {
        let ONE: FP16 = 1.0;
        let bam: number = fp16ToInt(t) * 512;
        return ONE - Math.cos(bam);
    }

    // sin(t*π/2)
    export function easeOutSine(t: FP16): FP16 {
        let bam: number = fp16ToInt(t) * 512;
        return Math.sin(bam);
    }

    // (1 - cos(t*π)) / 2
    export function easeInOutSine(t: FP16): FP16 {
        let ONE: FP16 = 1.0;
        let bam: number = fp16ToInt(t) * 1024;
        let cosv: FP16 = Math.cos(bam);
        return (ONE - cosv) / 2;
    }

    // ── Customisable power ease ───────────────────────────────────────────────

    export function easeInPow(t: FP16, power: number): FP16 {
        let result: FP16 = intToFP16(1);
        let i: number = 0;
        while (i < power) {
            result = result * t;
            i = i + 1;
        }
        return result;
    }

    export function easeOutPow(t: FP16, power: number): FP16 {
        let ONE: FP16 = 1.0;
        let inv: FP16 = ONE - t;
        let acc: FP16 = intToFP16(1);
        let i: number = 0;
        while (i < power) {
            acc = acc * inv;
            i = i + 1;
        }
        return ONE - acc;
    }

    // ── Bézier ────────────────────────────────────────────────────────────────

    // Quadratic Bézier: (1-t)²·a + 2(1-t)t·b + t²·c
    export function bezierQuad(a: FP16, b: FP16, c: FP16, t: FP16): FP16 {
        let ONE: FP16 = 1.0;
        let TWO: FP16 = 2.0;
        let inv: FP16 = ONE - t;
        let inv2: FP16 = inv * inv;
        let t2: FP16 = t * t;
        let twoinvt: FP16 = TWO * inv;
        twoinvt = twoinvt * t;
        let p0: FP16 = inv2 * a;
        let p1: FP16 = twoinvt * b;
        let p2: FP16 = t2 * c;
        return p0 + p1 + p2;
    }

    // ── Oscillation ───────────────────────────────────────────────────────────

    // Integer bounce 0→period→0→period…
    export function pingPong(t: number, period: number): number {
        let full: number = period * 2;
        let q: number = t / full;
        let phase: number = t - q * full;
        let result: number = 0;
        if (phase < period) {
            result = phase;
        } else {
            result = full - phase;
        }
        return result;
    }

    // FP16 [0.0, 1.0] oscillation — period < 16384 to avoid overflow
    export function oscillateFP(t: number, period: number): FP16 {
        let full: number = period * 2;
        let q: number = t / full;
        let phase: number = t - q * full;
        if (phase >= period) {
            phase = full - phase;
        }
        let num: number = phase * 65536;
        return num / period;
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    // Move current toward target by step, clamp at target
    export function approach(current: number, target: number, step: number): number {
        let result: number = 0;
        if (current < target) {
            result = current + step;
            if (result > target) {
                result = target;
            }
        } else {
            result = current - step;
            if (result < target) {
                result = target;
            }
        }
        return result;
    }

    // Square wave: 1 while (t % period) < duty, else 0
    export function pulse(t: number, period: number, duty: number): number {
        let q: number = t / period;
        let phase: number = t - q * period;
        let result: number = 0;
        if (phase < duty) {
            result = 1;
        }
        return result;
    }
}
