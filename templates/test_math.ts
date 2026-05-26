import '../include/TCSet100/types';

class TestMath extends CEvent {
    constructor() { super('InitComplete'); }
    public Append(): void {
        let a: FP16 = 2.0;   // 131072
        let b: FP16 = 0.5;   // 32768
        let angle: number = 512;  // 90° in BAM

        // ── Rounding ──────────────────────────────────────────────────────
        checkEq("floor(2.0)", 2, Math.floor(a));
        checkEq("ceil(0.5)", 1, Math.ceil(b));
        checkEq("round(0.5)", 1, Math.round(b));

        // ── FP-preserving ─────────────────────────────────────────────────
        checkFpEq("abs(2.0)", 131072, Math.abs(a));
        checkFpEq("sqrt(2.0)", 92672, Math.sqrt(a));
        checkFpEq("min(2.0,0.5)", 32768, Math.min(a, b));
        checkFpEq("max(2.0,0.5)", 131072, Math.max(a, b));
        checkFpEq("clamp(2,0.5,1.0)", 65536, Math.clamp(a, b, intToFP16(1)));

        // ── Trig (integer BAM) ────────────────────────────────────────────
        checkFpEq("sin(512bam)", 65536, Math.sin(angle));
        checkFpEq("cos(512bam)", 0, Math.cos(angle));

        // ── Trig (FP16 degrees) ───────────────────────────────────────────
        checkFpEq("sin(1.93fp)", 2287, Math.sin(1.93));
        checkFpEq("tan(1.93fp)", 2287, Math.tan(1.93));

        // ── Angle conversions ─────────────────────────────────────────────
        checkEq("toBAM(90)", 512, Math.toBAM(90));
        checkEq("toDeg(512)", 90, Math.toDeg(512));
        checkFpEq("toRad(90)", 102960, Math.toRad(90));
        checkEq("toBAM(2.0fp)", 11, Math.toBAM(a));

        // ── Power ─────────────────────────────────────────────────────────
        checkEq("pow(2,10)", 1024, Math.pow(2, 10));
        checkFpEq("pow(2.0,3)", 524288, Math.pow(a, 3));

        // ── Log ───────────────────────────────────────────────────────────
        checkFpEq("log(2)", 45426, Math.log(2));
        checkFpEq("log2(8)", 196608, Math.log2(8));
        checkFpEq("log10(100)", 118374, Math.log10(100));
        checkFpEq("log(2.0fp)", 45426, Math.log(a));

        // ── Exp ───────────────────────────────────────────────────────────
        checkFpEq("exp(2.0)", 484417, Math.exp(a));

        // ── Utilities ─────────────────────────────────────────────────────
        checkEq("divr(7,2)", 4, Math.divr(7, 2));
        checkEq("atan2(100,100)", 256, Math.atan2(100, 100));
    }
}
