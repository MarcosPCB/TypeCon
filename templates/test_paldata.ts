import '../include/TCSet100/types';

class TestPalData extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        // ── paldata (all readonly) ─────────────────────────────────────────
        let noFloor0: number = paldata[0].noFloorPal;
        let noFloor1: number = paldata[1].noFloorPal;

        console.log("test_paldata OK");
    }
}
