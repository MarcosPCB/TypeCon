import '../../../include/TCSet100/types';

class TestInput extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        // ── raw CON names ──────────────────────────────────────────────────
        let fv: number  = input[0].fvel;
        let sv: number  = input[0].svel;
        let av: number  = input[0].avel;
        let hz: number  = input[0].horz;
        let bt: number  = input[0].bits;
        let eb: number  = input[0].extBits;

        // ── friendly aliases ───────────────────────────────────────────────
        let fwd: number  = input[0].forwardVel;
        let str: number  = input[0].strafeVel;
        let trn: number  = input[0].turnVel;
        let lup: number  = input[0].lookUp;
        let btn: number  = input[0].buttons;
        let ext: number  = input[0].extButtons;

        // ── motion sub-object ──────────────────────────────────────────────
        let mfwd: number = input[0].motion.forward;
        let mstr: number = input[0].motion.strafe;
        let mtrn: number = input[0].motion.turn;
        let mlup: number = input[0].motion.lookUp;

        // writes
        input[0].fvel       = 0;
        input[0].forwardVel = 0;
        input[0].motion.forward = 0;
        input[0].motion.strafe  = 0;
        input[0].motion.turn    = 0;
        input[0].motion.lookUp  = 0;

        console.log("test_input OK");
    }
}
