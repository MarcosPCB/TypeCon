import '../include/TCSet100/types';

class TestActor extends CActor {
    constructor() { super(0, false, 0); }
    public Append(): void {
        // singleton: resolves to players[THISACTOR]
        let hp: number = player.health;
        let ang: number = player.ang;
        player.god = true;

        // indexed form still works
        let hp0: number = players[0].health;
    }
}
