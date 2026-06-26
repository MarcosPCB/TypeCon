import '../../../include/TCSet100/types';
import DN3D from '../../../include/TCSet100/DN3D/game';

const TILE_BARREL: GameLabel = DN3D.ENames.NUKEBARREL;

// ── Global functions ─────────────────────────────────────────────────────────

class TestGlobals extends CEvent<'DisplayEnd'> {
    constructor() { super('DisplayEnd'); }

    public Append(): void {
        const ticks: number = game.getTicks();
        const delta: number = Math.getIncAngle(0, 512);
        game.map.StartTrack(0, 1);
        UserQuote(10);
        game.map.StopAllMusic();
        game.map.state.Save();
        game.map.state.Load();
        game.map.state.Clear();
    }
}

// ── CActor methods ────────────────────────────────────────────────────────────

class TestActorNatives extends CActor {
    protected readonly actions: TAction<'aIdle'> = {
        aIdle: { start: 0, length: 1, viewType: 1, incValue: 0, delay: 0 },
    };

    constructor() { super(DN3D.ENames.NUKEBARREL, false, 0); }

    public main(first_action = this.actions.aIdle): void {
        const dist: number = this.FindPlayer();
        this.Tip();
        if (this.PlayerHitSpace()) {
            this.extra = 1;
            this.spriteflags = ESpriteFlags.BADGUY | ESpriteFlags.SHADOW;
        }
        this.KillIt();
    }
}
