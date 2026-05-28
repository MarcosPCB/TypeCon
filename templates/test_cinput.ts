import '../include/TCSet100/types';

class MyInput extends CInput {
    public Append(): void {
        let fwd: number = input.fvel;
        let str: number = input.strafeVel;
        input.fvel = 0;
        input[0].avel = 0;
    }
}
