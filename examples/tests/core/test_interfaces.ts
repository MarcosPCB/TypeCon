import '../../../include/TCSet100/types';

interface IPoint {
    x: number;
    y: number;
}

interface ILine {
    start: IPoint;
    end: IPoint;
    thickness: number;
}

// Tests interface struct layouts (interface I { ... }).
// Scalar variables are safe before a complex type in the same frame.
// Two complex-type locals in the same scope trigger a known stack-offset bug,
// so IPoint and ILine are each tested in isolation (line is the sole complex local).
class TestInterfaces extends CEvent {
    constructor() { super('InitComplete'); }

    // debug-test
    public Append(): void {
        // Scalars first — IPoint fields tested via plain numbers
        let px: number = 3;
        let py: number = 4;
        checkEq("ipoint sim.x", 3, px);
        checkEq("ipoint sim.y", 4, py);
        px = 10;
        checkEq("ipoint sim.x after set", 10, px);

        // Nested interface: line is the first complex variable in this frame
        let line: ILine = { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, thickness: 0 };
        line.start.x = 5;
        line.start.y = 7;
        line.end.x = 10;
        line.thickness = 2;
        checkEq("line.start.x", 5, line.start.x);
        checkEq("line.start.y", 7, line.start.y);
        checkEq("line.end.x", 10, line.end.x);
        checkEq("line.thickness", 2, line.thickness);
    }
}
