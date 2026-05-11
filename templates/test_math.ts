import '../include/TCSet100/types';

class TestMath extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        let a: FP16 = 2.0;   // 131072
        let b: FP16 = 0.5;   // 32768
        let angle: number = 512;

        // Rounding: FP input → integer via shiftr
        let fl = Math.floor(a);    // 2
        let ce = Math.ceil(b);     // 1
        let ro = Math.round(b);    // 1
        PrintValue(fl);   // expect 2
        PrintValue(ce);   // expect 1
        PrintValue(ro);   // expect 1

        // FP-preserving
        let ab: FP16 = Math.abs(a);    // 131072
        let sq: FP16 = Math.sqrt(a);   // ~92682 (sqrt(2) FP16)
        let mn: FP16 = Math.min(a, b); // 32768
        let mx: FP16 = Math.max(a, b); // 131072
        let cl: FP16 = Math.clamp(a, b, intToFP16(1)); // 65536 (clamped to 1.0)
        PrintValue(ab);   // expect 131072
        PrintValue(sq);   // expect ~92682
        PrintValue(mn);   // expect 32768
        PrintValue(mx);   // expect 131072
        PrintValue(cl);   // expect 65536

        // Trig: integer BAM input
        let s: FP16  = Math.sin(angle);  // sin(512 BAM) = sin(90°) → 65536
        let c: FP16  = Math.cos(angle);  // cos(90°) → 0
        let t: FP16  = Math.tan(angle);  // state _Math_tan
        PrintValue(s);    // expect 65536
        PrintValue(c);    // expect 0
        PrintValue(t);    // expect very large (tan 90°)

        // Trig: FP16 degree input (auto-convert to BAM)
        let sFP: FP16 = Math.sin(a);   // sin(2°) FP16
        let tFP: FP16 = Math.tan(a);   // state _Math_tanFP
        PrintValue(sFP);  // expect ~2285
        PrintValue(tFP);  // expect ~2285

        // Angle conversions
        let bam   = Math.toBAM(90);   // 512
        let deg   = Math.toDeg(512);  // 90
        let rad: FP16 = Math.toRad(90); // ~102960
        let bamFP = Math.toBAM(a);    // ~11 (2° → BAM)
        PrintValue(bam);   // expect 512
        PrintValue(deg);   // expect 90
        PrintValue(rad);   // expect ~102960
        PrintValue(bamFP); // expect ~11

        // Power
        let p      = Math.pow(2, 10);       // 1024
        let pFP: FP16 = Math.pow(a, 3);     // 524288 (8.0 FP16)
        PrintValue(p);    // expect 1024
        PrintValue(pFP);  // expect 524288

        // Log
        let ln2: FP16  = Math.log(2);     // 45426
        let lg2: FP16  = Math.log2(8);    // 196608 (3.0 FP16)
        let lg10: FP16 = Math.log10(100); // ~118374
        let lnFP: FP16 = Math.log(a);     // 45426 (log of 2.0 FP16)
        PrintValue(ln2);   // expect 45426
        PrintValue(lg2);   // expect 196608
        PrintValue(lg10);  // expect ~118374
        PrintValue(lnFP);  // expect 45426

        // Exp
        let ea: FP16 = Math.exp(a);  // e^2.0 → ~484417
        PrintValue(ea);    // expect ~484417

        // Random / divr / atan2
        let r  = Math.random();
        let ri = Math.randomInt(100);
        let dr = Math.divr(7, 2);    // 4 (rounded)
        let ang = Math.atan2(100, 100); // 256 (45° BAM)
        PrintValue(r);    // 0–65535 (random)
        PrintValue(ri);   // 0–99 (random)
        PrintValue(dr);   // expect 4
        PrintValue(ang);  // expect 256
    }
}
