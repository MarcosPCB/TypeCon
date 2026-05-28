import '../include/TCSet100/types';

class TestSectorsNew extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        // ── ceiling new fields ─────────────────────────────────────────────
        let ceilZGoal: number = sectors[0].ceiling.zGoal;
        let ceilZVel: number  = sectors[0].ceiling.zVel;

        sectors[0].ceiling.zGoal = 0;
        sectors[0].ceiling.zVel  = 0;

        // ── floor new fields ───────────────────────────────────────────────
        let floorZGoal: number = sectors[0].floor.zGoal;
        let floorZVel: number  = sectors[0].floor.zVel;

        sectors[0].floor.zGoal = 0;
        sectors[0].floor.zVel  = 0;

        console.log("test_sectors_new OK");
    }
}
