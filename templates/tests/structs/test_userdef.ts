import '../../../include/TCSet100/types';

class TestUserDef extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        // ── flat fields ────────────────────────────────────────────────────
        let bright: number   = userdef[0].brightness;
        let godMode: number  = userdef[0].god;
        let lvlNum: number   = userdef[0].levelNum;
        let volNum: number   = userdef[0].volumeNum;
        let multi: number    = userdef[0].multiMode;
        let np: number       = userdef[0].numPlayers;
        let musEp: number    = userdef[0].musicEpisode;
        let musLv: number    = userdef[0].musicLevel;
        let skill: number    = userdef[0].playerSkill;
        let camDist: number  = userdef[0].cameraDist;
        let camClk: number   = userdef[0].cameraClock;
        let scroll: number   = userdef[0].scrollMode;
        let scrSize: number  = userdef[0].screenSize;
        let coop: number     = userdef[0].coop;

        userdef[0].brightness  = 8;
        userdef[0].god         = 0;
        userdef[0].scrollMode  = 0;
        userdef[0].screenSize  = 4;

        // ── returnData array ───────────────────────────────────────────────
        let ret0: number = userdef[0].returnData[0];
        let ret1: number = userdef[0].returnData[1];

        userdef[0].returnData[0] = 0;

        // ── level sub-object ───────────────────────────────────────────────
        let lNum: number  = userdef[0].level.number;
        let lVol: number  = userdef[0].level.volume;
        let lSkill: number = userdef[0].level.skill;
        let lMusEp: number = userdef[0].level.musicEpisode;
        let lMusLv: number = userdef[0].level.musicLevel;

        userdef[0].level.number = 0;
        userdef[0].level.skill  = 2;

        // ── screen sub-object ──────────────────────────────────────────────
        let sBright: number = userdef[0].screen.brightness;
        let sSize: number   = userdef[0].screen.size;
        let sScroll: number = userdef[0].screen.scrollMode;

        userdef[0].screen.brightness = 8;
        userdef[0].screen.size       = 4;

        // ── camera sub-object ──────────────────────────────────────────────
        let cDist: number  = userdef[0].camera.dist;
        let cClock: number = userdef[0].camera.clock;

        userdef[0].camera.dist  = 100;
        userdef[0].camera.clock = 0;

        // ── multi sub-object ───────────────────────────────────────────────
        let mMode: number = userdef[0].multi.mode;
        let mNum: number  = userdef[0].multi.numPlayers;
        let mCoop: number = userdef[0].multi.coop;

        userdef[0].multi.mode = 0;
        userdef[0].multi.coop = 0;

        console.log("test_userdef OK");
    }
}
