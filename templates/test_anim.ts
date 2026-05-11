import '../include/TCSet100/types';
import { AnimUtils } from '../include/TCSet100/AnimUtils';

class TestAnim extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        let t: FP16 = 0.5;    // 32768
        let a: FP16 = 0.0;    // 0
        let b: FP16 = 1.0;    // 65536

        // Interpolation
        let lv:  FP16 = AnimUtils.lerp(a, b, t);             // 32768  (0.5)
        PrintValue(lv);   // expect 32768

        // Smooth steps — all return 0.5 at t=0.5
        let ss:  FP16 = AnimUtils.smoothstep(t);              // 32768
        let se:  FP16 = AnimUtils.smootherstep(t);            // 32768
        PrintValue(ss);   // expect 32768
        PrintValue(se);   // expect 32768

        // Quadratic ease
        let q1:  FP16 = AnimUtils.easeInQuad(t);              // 16384  (0.25)
        let q2:  FP16 = AnimUtils.easeOutQuad(t);             // 49152  (0.75)
        let q3:  FP16 = AnimUtils.easeInOutQuad(t);           // 32768  (0.5)
        PrintValue(q1);   // expect 16384
        PrintValue(q2);   // expect 49152
        PrintValue(q3);   // expect 32768

        // Cubic ease
        let c1:  FP16 = AnimUtils.easeInCubic(t);             // 8192   (0.125)
        let c2:  FP16 = AnimUtils.easeOutCubic(t);            // 57344  (0.875)
        PrintValue(c1);   // expect 8192
        PrintValue(c2);   // expect 57344

        // Quintic ease
        let p1:  FP16 = AnimUtils.easeInQuint(t);             // 2048   (0.03125)
        let p2:  FP16 = AnimUtils.easeOutQuint(t);            // 63488  (0.96875)
        PrintValue(p1);   // expect 2048
        PrintValue(p2);   // expect 63488

        // Sine ease (BAM-based, loses sub-degree precision)
        let s1:  FP16 = AnimUtils.easeInSine(t);              // ~17471
        let s2:  FP16 = AnimUtils.easeOutSine(t);             // ~48064
        let s3:  FP16 = AnimUtils.easeInOutSine(t);           // ~32768
        PrintValue(s1);   // expect ~17471
        PrintValue(s2);   // expect ~48064
        PrintValue(s3);   // expect ~32768

        // Power ease (arbitrary exponent)
        let ep1: FP16 = AnimUtils.easeInPow(t, 4);            // 4096   (0.0625)
        let ep2: FP16 = AnimUtils.easeOutPow(t, 4);           // 61440  (0.9375)
        PrintValue(ep1);  // expect 4096
        PrintValue(ep2);  // expect 61440

        // Bezier quadratic
        let bz:  FP16 = AnimUtils.bezierQuad(a, b, b, t);    // 49152  (0.75)
        PrintValue(bz);   // expect 49152

        // Oscillation
        let pp:  number = AnimUtils.pingPong(100, 60);        // 40
        let osc: FP16   = AnimUtils.oscillateFP(100, 60);    // ~43690 (≈0.667)
        PrintValue(pp);   // expect 40
        PrintValue(osc);  // expect ~43690

        // Utilities
        let app: number = AnimUtils.approach(20, 100, 5);    // 25
        let pls: number = AnimUtils.pulse(100, 60, 20);      // 0 (phase 40 >= duty 20)
        PrintValue(app);  // expect 25
        PrintValue(pls);  // expect 0
    }
}
