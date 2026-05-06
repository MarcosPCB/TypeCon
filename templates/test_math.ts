import '../include/TCSet100/types';

class TestMath extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        let a: FP16 = 2.0;   // 131072
        let b: FP16 = 0.5;   // 32768
        let angle: number = 512;

        // Rounding: FP input → integer via shiftr
        let fl = Math.floor(a);    // shiftr r0 16 → set rb r0 → 2
        let ce = Math.ceil(b);     // add r0 65535 / shiftr 16 → 1
        let ro = Math.round(b);    // add r0 32768 / shiftr 16 → 1

        // FP-preserving: result keeps curFpBits = 16
        let ab: FP16 = Math.abs(a);    // set rb r0 / abs rb
        let sq: FP16 = Math.sqrt(a);   // sqrt r0 rb / shiftl rb 8
        let mn: FP16 = Math.min(a, b); // → 32768 (0.5)
        let mx: FP16 = Math.max(a, b); // → 131072 (2.0)
        let cl: FP16 = Math.clamp(a, b, intToFP16(1));

        // Trig: integer BAM
        let s: FP16  = Math.sin(angle);  // sin rb r0 / shiftl rb 2
        let c: FP16  = Math.cos(angle);
        let t: FP16  = Math.tan(angle);  // state _Math_tan

        // Trig: FP16 degrees (auto-convert to BAM)
        let sFP: FP16 = Math.sin(a);   // shiftr 16 / mul 2048 / div 360 / sin / shiftl 2
        let tFP: FP16 = Math.tan(a);   // state _Math_tanFP

        // Angle conversions
        let bam = Math.toBAM(90);       // 512
        let deg = Math.toDeg(512);      // 90
        let rad: FP16 = Math.toRad(90); // 102960 ≈ PI/2 FP16
        let bamFP = Math.toBAM(a);      // FP16 2.0° → BAM (≈ 11)

        // Power
        let p   = Math.pow(2, 10);        // 1024; state _Math_pow
        let pFP: FP16 = Math.pow(a, 3);   // 8.0 FP16; state _Math_powFP

        // Log
        let ln2: FP16  = Math.log(2);      // 1 × 45426; state _Math_log
        let lg2: FP16  = Math.log2(8);     // 3 × 65536; state _Math_log2
        let lg10: FP16 = Math.log10(100);  // state _Math_log10
        let lnFP: FP16 = Math.log(a);      // state _Math_logFP

        // Exp
        let ea: FP16 = Math.exp(a);     // e^2.0 FP16; state _Math_exp

        // Random / divr
        let r  = Math.random();
        let ri = Math.randomInt(100);
        let dr = Math.divr(7, 2);       // 4 (rounded)

        // atan2
        let ang = Math.atan2(100, 100);
    }
}
