import '../../../include/TCSet100/types';
import DN3D from '../../../include/TCSet100/DN3D/game';

// Test analysis commands in a display event (global context)
class TestAnalysis extends CEvent<'DisplayEnd'> {
    constructor() { super('DisplayEnd'); }

    public Append(): void {
        const sight: boolean = CheckSpriteSight(0, 1);
        const sect: number = game.map.SectorOfWall(0);
        const sect2: number = game.map.UpdateSectorZ(0, 0, 0);
        const sect3: number = game.map.UpdateSectorNeighbor(0, 0);
        const sect4: number = game.map.UpdateSectorNeighborZ(0, 0, 0);
        const motion: number = game.map.CheckActivatorMotion(0);
        const hit: HitscanResult = game.map.Hitscan(0, 0, 0, 0, 0, 0, 1024, 0);
        const near: NearTagResult = game.map.NearTag(0, 0, 0, 0, 0, 1024, 3);
        const zr: ZRangeResult = game.map.GetZRange(0, 0, 0, 0, 128, 0);
        const li: IntersectResult = Math.LineIntersect(0, 0, 0, 1, 0, 0, 0, -100, 0, 100);
        const ri: IntersectResult = Math.RayIntersect(0, 0, 0, 1, 0, 0, 0, -100, 0, 100);
    }
}

// Test CActor.player in an actor
class TestActorPlayer extends CActor {
    protected readonly actions: TAction<'aIdle'> = {
        aIdle: { start: 0, length: 1, viewType: 1, incValue: 0, delay: 0 },
    };

    constructor() { super(DN3D.ENames.NUKEBARREL, false, 0); }

    public main(first_action = this.actions.aIdle): void {
        if (this.PlayerHitSpace()) {
            this.player.AddAmmo(1, 50);
            this.player.AddHealth(10);
            this.player.WackPlayer();
            this.player.Pstomp();
        }
        this.KillIt();
    }
}
