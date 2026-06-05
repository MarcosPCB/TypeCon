import '../../../include/TCSet100/types';

class TestActor extends CActor {
    constructor() { super(0, false, 0); }
    // debug-test
    public Append(): void {
        // singleton: resolves to players[THISACTOR]
        let hp: number = player.health;
        let ang: number = player.ang;

        // indexed form still works
        let hp0: number = players[0].health;
    }
}
