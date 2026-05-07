import './types';

/**
 * Animation and timing utilities for TypeCON.
 *
 * All functions operate in FP16 fixed-point (Q15.16, 1.0 = 65536) unless the
 * parameter/return type is `number`, which indicates a plain integer.
 *
 * Import as a named import so the TypeScript server resolves the namespace:
 * ```ts
 * import { AnimUtils } from '../include/TCSet100/AnimUtils';
 * ```
 */
export namespace AnimUtils {

    // ── Interpolation ─────────────────────────────────────────────────────────

    /**
     * Linear interpolation between `a` and `b` by factor `t`.
     * @param a Start value (FP16).
     * @param b End value (FP16).
     * @param t Blend factor in [0.0, 1.0] (FP16).
     * @returns `a + (b - a) * t` (FP16).
     */
    export function lerp(a: FP16, b: FP16, t: FP16): FP16 {
        let diff: FP16 = b - a;
        return a + diff * t;
    }

    // ── Smooth steps ──────────────────────────────────────────────────────────

    /**
     * Cubic smooth-step: `3t² - 2t³`.
     * Produces a smooth S-curve with zero derivative at both endpoints.
     * @param t Input in [0.0, 1.0] (FP16).
     * @returns Smoothed value in [0.0, 1.0] (FP16).
     */
    export function smoothstep(t: FP16): FP16 {
        let t2: FP16 = t * t;
        let t3: FP16 = t2 * t;
        let THREE: FP16 = intToFP16(3);
        let TWO: FP16 = 2.0;
        return THREE * t2 - TWO * t3;
    }

    /**
     * Quintic smoother-step: `6t⁵ - 15t⁴ + 10t³`.
     * Zero first and second derivative at both endpoints — smoother than
     * `smoothstep` but more expensive.
     * @param t Input in [0.0, 1.0] (FP16).
     * @returns Smoothed value in [0.0, 1.0] (FP16).
     */
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

    /**
     * Ease-in quadratic: `t²`. Starts slow, accelerates.
     * @param t Input in [0.0, 1.0] (FP16).
     * @returns Eased value (FP16).
     */
    export function easeInQuad(t: FP16): FP16 {
        return t * t;
    }

    /**
     * Ease-out quadratic: `1 - (1-t)²`. Starts fast, decelerates.
     * @param t Input in [0.0, 1.0] (FP16).
     * @returns Eased value (FP16).
     */
    export function easeOutQuad(t: FP16): FP16 {
        let ONE: FP16 = 1.0;
        let inv: FP16 = ONE - t;
        return ONE - inv * inv;
    }

    /**
     * Ease-in-out quadratic: `2t²` for `t < 0.5`, `1 - 2(1-t)²` otherwise.
     * Symmetric S-curve with quadratic acceleration and deceleration.
     * @param t Input in [0.0, 1.0] (FP16).
     * @returns Eased value (FP16).
     */
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

    /**
     * Ease-in cubic: `t³`. More pronounced acceleration than quadratic.
     * @param t Input in [0.0, 1.0] (FP16).
     * @returns Eased value (FP16).
     */
    export function easeInCubic(t: FP16): FP16 {
        let t2: FP16 = t * t;
        return t2 * t;
    }

    /**
     * Ease-out cubic: `1 - (1-t)³`. More pronounced deceleration than quadratic.
     * @param t Input in [0.0, 1.0] (FP16).
     * @returns Eased value (FP16).
     */
    export function easeOutCubic(t: FP16): FP16 {
        let ONE: FP16 = 1.0;
        let inv: FP16 = ONE - t;
        let inv2: FP16 = inv * inv;
        return ONE - inv2 * inv;
    }

    // ── Quintic ease ──────────────────────────────────────────────────────────

    /**
     * Ease-in quintic: `t⁵`. Very sharp initial acceleration.
     * @param t Input in [0.0, 1.0] (FP16).
     * @returns Eased value (FP16).
     */
    export function easeInQuint(t: FP16): FP16 {
        let t2: FP16 = t * t;
        let t4: FP16 = t2 * t2;
        return t4 * t;
    }

    /**
     * Ease-out quintic: `1 - (1-t)⁵`. Very sharp deceleration at the end.
     * @param t Input in [0.0, 1.0] (FP16).
     * @returns Eased value (FP16).
     */
    export function easeOutQuint(t: FP16): FP16 {
        let ONE: FP16 = 1.0;
        let inv: FP16 = ONE - t;
        let inv2: FP16 = inv * inv;
        let inv4: FP16 = inv2 * inv2;
        return ONE - inv4 * inv;
    }

    // ── Sine ease ─────────────────────────────────────────────────────────────
    // BAM angle mapping: quarter turn (π/2) = t_raw / 128  →  [0, 511]
    //                    half turn   (π)   = t_raw / 64   →  [0, 1023]

    /**
     * Ease-in sine: `1 - cos(t·π/2)`.
     * Uses BAM angles; loses sub-degree precision for small `t`.
     * @param t Input in [0.0, 1.0] (FP16).
     * @returns Eased value (FP16).
     */
    export function easeInSine(t: FP16): FP16 {
        let ONE: FP16 = 1.0;
        let bam: number = fp16ToInt(t) * 512;
        return ONE - Math.cos(bam);
    }

    /**
     * Ease-out sine: `sin(t·π/2)`.
     * Uses BAM angles; loses sub-degree precision for small `t`.
     * @param t Input in [0.0, 1.0] (FP16).
     * @returns Eased value (FP16).
     */
    export function easeOutSine(t: FP16): FP16 {
        let bam: number = fp16ToInt(t) * 512;
        return Math.sin(bam);
    }

    /**
     * Ease-in-out sine: `(1 - cos(t·π)) / 2`.
     * Uses BAM angles; loses sub-degree precision for small `t`.
     * @param t Input in [0.0, 1.0] (FP16).
     * @returns Eased value (FP16).
     */
    export function easeInOutSine(t: FP16): FP16 {
        let ONE: FP16 = 1.0;
        let bam: number = fp16ToInt(t) * 1024;
        let cosv: FP16 = Math.cos(bam);
        return (ONE - cosv) / 2;
    }

    // ── Customisable power ease ───────────────────────────────────────────────

    /**
     * Ease-in with arbitrary integer power: `t^power`.
     * Computed via a mulscale loop — negative `power` returns 1.0.
     * @param t Input in [0.0, 1.0] (FP16).
     * @param power Exponent (plain integer, e.g. 4 for quartic).
     * @returns Eased value (FP16).
     */
    export function easeInPow(t: FP16, power: number): FP16 {
        let result: FP16 = intToFP16(1);
        let i: number = 0;
        while (i < power) {
            result = result * t;
            i = i + 1;
        }
        return result;
    }

    /**
     * Ease-out with arbitrary integer power: `1 - (1-t)^power`.
     * Computed via a mulscale loop — negative `power` returns 0.0.
     * @param t Input in [0.0, 1.0] (FP16).
     * @param power Exponent (plain integer, e.g. 4 for quartic).
     * @returns Eased value (FP16).
     */
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

    /**
     * Quadratic Bézier curve: `(1-t)²·a + 2(1-t)t·b + t²·c`.
     * All control points and `t` must be FP16; result is accurate for
     * `t ∈ [0.0, 1.0]`.
     * @param a Start control point (FP16).
     * @param b Middle control point (FP16).
     * @param c End control point (FP16).
     * @param t Curve parameter in [0.0, 1.0] (FP16).
     * @returns Point on the curve (FP16).
     */
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

    /**
     * Integer ping-pong: bounces `t` back and forth in `[0, period]`.
     * `t=0..period` → 0..period, `t=period..2*period` → period..0, then repeats.
     * @param t Elapsed time (integer).
     * @param period Half-cycle length (integer).
     * @returns Bounced value in [0, period] (integer).
     */
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

    /**
     * FP16 oscillation in [0.0, 1.0]: normalised ping-pong.
     * Keep `period < 16384` to avoid integer overflow in the intermediate
     * `phase * 65536` multiplication.
     * @param t Elapsed time (integer).
     * @param period Half-cycle length (integer).
     * @returns Oscillating value in [0.0, 1.0] (FP16).
     */
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

    /**
     * Moves `current` toward `target` by `step`, clamping at `target`.
     * Works for both positive and negative directions.
     * @param current Starting value (integer).
     * @param target Destination value (integer).
     * @param step Maximum change per call (integer, must be positive).
     * @returns New value clamped to `target` (integer).
     */
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

    /**
     * Square-wave pulse: returns 1 while `(t % period) < duty`, else 0.
     * Useful for on/off blinking or timed triggers.
     * @param t Elapsed time (integer).
     * @param period Full cycle length (integer).
     * @param duty Active portion of each cycle (integer, must be < `period`).
     * @returns 1 during the active phase, 0 otherwise (integer).
     */
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
