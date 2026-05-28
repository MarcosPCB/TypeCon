import '../include/TCSet100/types';

class TestSpritesNew extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        let idx: number = thisActor;

        // ── hitType sub-object ─────────────────────────────────────────────
        let stayPut: number  = sprites[idx].hitType.stayPutSector;
        let lastAng: number  = sprites[idx].hitType.lastAngle;
        let lastVX: number   = sprites[idx].hitType.lastVelX;
        let lastVY: number   = sprites[idx].hitType.lastVelY;
        let movFlag: number  = sprites[idx].hitType.moveFlag;
        let tempAng: number  = sprites[idx].hitType.tempAngle;
        let sleep: number    = sprites[idx].hitType.timeToSleep;
        let ceilZ: number    = sprites[idx].hitType.ceilingZ;
        let floorZ: number   = sprites[idx].hitType.floorZ;

        sprites[idx].hitType.stayPutSector = 0;
        sprites[idx].hitType.lastAngle     = 0;
        sprites[idx].hitType.lastVelX      = 0;
        sprites[idx].hitType.lastVelY      = 0;
        sprites[idx].hitType.moveFlag      = 0;
        sprites[idx].hitType.tempAngle     = 0;
        sprites[idx].hitType.timeToSleep   = 100;

        // ── hitInfo sub-object (htg_t 6-8) ────────────────────────────────
        let hitWall: number   = sprites[idx].hitInfo.wall;
        let hitSect: number   = sprites[idx].hitInfo.sector;
        let hitSpr: number    = sprites[idx].hitInfo.sprite;

        sprites[idx].hitInfo.wall   = -1;
        sprites[idx].hitInfo.sector = -1;
        sprites[idx].hitInfo.sprite = -1;

        // ── missing htg_t entries ─────────────────────────────────────────
        let curCnt: number  = sprites[idx].curCount;
        let actCnt: number  = sprites[idx].curActionCount;

        sprites[idx].curCount       = 0;
        sprites[idx].curActionCount = 0;

        console.log("test_sprites_new OK");
    }
}
