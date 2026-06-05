import '../../../include/TCSet100/types';

class TestInput extends CEvent {
    constructor() { super('NewGame'); }
    // debug-test
    public Append(): void {
        // ── raw CON names ──────────────────────────────────────────────────
        let fv: number = input[0].fvel;
        let sv: number = input[0].svel;
        let av: number = input[0].avel;
        let hz: number = input[0].horz;
        let bt: number = input[0].bits;
        let eb: number = input[0].extBits;

        // ── friendly aliases ───────────────────────────────────────────────
        let fwd: number = input[0].forwardVel;
        let str: number = input[0].strafeVel;
        let trn: number = input[0].turnVel;
        let lup: number = input[0].lookUp;
        let btn: number = input[0].buttons;
        let ext: number = input[0].extButtons;

        // ── motion sub-object ──────────────────────────────────────────────
        let mfwd: number = input[0].motion.forward;
        let mstr: number = input[0].motion.strafe;
        let mtrn: number = input[0].motion.turn;
        let mlup: number = input[0].motion.lookUp;

        // writes
        input[0].fvel = 0;
        input[0].forwardVel = 0;
        input[0].motion.forward = 0;
        input[0].motion.strafe = 0;
        input[0].motion.turn = 0;
        input[0].motion.lookUp = 0;

        checkEq('fv', 0, 0);
        checkEq('sv', 0, 0);
        checkEq('av', 0, 0);
        checkEq('hz', 0, 0);
        checkEq('bt', 0, 0);
        checkEq('eb', 0, 0);
        checkEq('fwd', 0, 0);
        checkEq('str', 0, 0);
        checkEq('trn', 0, 0);
        checkEq('lup', 0, 0);
        checkEq('btn', 0, 0);
        checkEq('ext', 0, 0);
        checkEq('mfwd', 0, 0);
        checkEq('mstr', 0, 0);
        checkEq('mtrn', 0, 0);
        checkEq('mlup', 0, 0);

        checkEq('input[0].fvel', 0, 0);
        checkEq('input[0].forwardVel', 0, 0);
        checkEq('input[0].motion.forward', 0, 0);
        checkEq('input[0].motion.strafe', 0, 0);
        checkEq('input[0].motion.turn', 0, 0);
        checkEq('input[0].motion.lookUp', 0, 0);
    }
}
