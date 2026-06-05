import '../../../include/TCSet100/types';

class MyInput extends CInput {
    // debug-test
    public Append(): void {
        let fwd: number = input.fvel;
        let str: number = input.strafeVel;
        input.fvel = 0;
        input[0].avel = 0;

        checkEq('input.fvel', 0, input.fvel)
        checkEq('input[0].avel', 0, input[0].avel)
    }
}
