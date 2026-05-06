import '../include/TCSet100/types';
import { AnimUtils } from '../include/TCSet100/AnimUtils';

class TestAnim extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        let t: FP16 = 0.5;    // 32768
        let a: FP16 = 0.0;    // 0
        let b: FP16 = 1.0;    // 65536

        let lv:  FP16 = AnimUtils.lerp(a, b, t);            // 0.5
        let ss:  FP16 = AnimUtils.smoothstep(t);              // 0.5
        let se:  FP16 = AnimUtils.smootherstep(t);            // 0.5
        let q1:  FP16 = AnimUtils.easeInQuad(t);              // 0.25
        let q2:  FP16 = AnimUtils.easeOutQuad(t);             // 0.75
        let q3:  FP16 = AnimUtils.easeInOutQuad(t);           // 0.5
        let c1:  FP16 = AnimUtils.easeInCubic(t);             // 0.125
        let c2:  FP16 = AnimUtils.easeOutCubic(t);            // 0.875
        let p1:  FP16 = AnimUtils.easeInQuint(t);             // 0.03125
        let p2:  FP16 = AnimUtils.easeOutQuint(t);            // 0.96875
        let s1:  FP16 = AnimUtils.easeInSine(t);
        let s2:  FP16 = AnimUtils.easeOutSine(t);
        let s3:  FP16 = AnimUtils.easeInOutSine(t);
        let ep1: FP16 = AnimUtils.easeInPow(t, 4);            // 0.0625
        let ep2: FP16 = AnimUtils.easeOutPow(t, 4);           // 0.9375
        let bz:  FP16 = AnimUtils.bezierQuad(a, b, b, t);    // 0.75
        let pp:  number = AnimUtils.pingPong(100, 60);        // 40
        let osc: FP16  = AnimUtils.oscillateFP(100, 60);     // ~43690 (≈0.667)
        let app: number = AnimUtils.approach(20, 100, 5);    // 25
        let pls: number = AnimUtils.pulse(100, 60, 20);      // 0 (100%60=40 >= 20)
    }
}
