import '../../../include/TCSet100/types';

type TVec2 = {
    x: number;
    y: number;
}

type TBox = {
    topLeft: TVec2;
    width: number;
    height: number;
}

// Tests type-alias struct records (type T = { ... }).
// Scalar variables are safe before a complex type in the same frame.
// Two complex-type locals in the same scope trigger a known stack-offset bug,
// so TVec2 and TBox are each tested in isolation (box is the sole complex local).
class TestTypeObjects extends CEvent {
    constructor() { super('InitComplete'); }

    // debug-test
    public Append(): void {
        // Scalars first — always safe, no inline stack expansion
        let x: number = 5;
        let y: number = 10;
        checkEq("tvec2 sim.x", 5, x);
        checkEq("tvec2 sim.y", 10, y);
        x = x * 2;
        checkEq("tvec2 sim.x*2", 10, x);

        // Nested type-alias: box is the first complex variable in this frame
        let box: TBox = { topLeft: { x: 0, y: 0 }, width: 0, height: 0 };
        box.topLeft.x = 20;
        box.topLeft.y = 30;
        box.width = 100;
        box.height = 50;
        checkEq("box.topLeft.x", 20, box.topLeft.x);
        checkEq("box.topLeft.y", 30, box.topLeft.y);
        checkEq("box.width", 100, box.width);
        checkEq("box.height", 50, box.height);
    }
}
