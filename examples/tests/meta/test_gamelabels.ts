import '../../../include/TCSet100/types';
import DN3D from '../../../include/TCSet100/DN3D/game';

// ── GameLabel definitions ────────────────────────────────────────────────────
const TILE_BARREL:  GameLabel = DN3D.ENames.NUKEBARREL;  // define TILE_BARREL 1227
const TILE_EXPLODE: GameLabel = DN3D.ENames.EXPLOSION2;  // define TILE_EXPLODE 1890
const TILE_TROOPER: GameLabel = 1680;                    // define TILE_TROOPER 1680

// ── Verify label use in all CONSTANT positions via a real actor ──────────────
// 1. picnum in useractor header  → useractor 0 TILE_BARREL ...
// 2. espawn CONSTANT arg         → espawn TILE_EXPLODE
// 3. numeric local assignment    → set ra TILE_TROOPER (inline)
class TestLabelActor extends CActor {
    protected readonly actions: TAction<'aIdle'> = {
        aIdle: { start: 0, length: 1, viewType: 1, incValue: 0, delay: 0 },
    };

    constructor() {
        super(TILE_BARREL, false, 0);
    }

    public main(first_action = this.actions.aIdle): void {
        this.Spawn(TILE_EXPLODE);
        const id: number = TILE_TROOPER;
        this.KillIt();
    }
}
