import '../include/TCSet100/types';

class TestPlayersNew extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        // ── resources sub-object ───────────────────────────────────────────
        let hp: number  = players[0].resources.health;
        let sh: number  = players[0].resources.shield;
        let jp: number  = players[0].resources.jetpack;
        let sc: number  = players[0].resources.scuba;
        let st: number  = players[0].resources.steroids;
        let inv0: number = players[0].resources.amounts[0];

        players[0].resources.health   = 100;
        players[0].resources.shield   = 0;
        players[0].resources.jetpack  = 0;
        players[0].resources.scuba    = 0;
        players[0].resources.steroids = 0;

        // ── status sub-object ──────────────────────────────────────────────
        let onGnd: number = players[0].status.onGround;
        let onLad: number = players[0].status.onLadder;
        let jump: number  = players[0].status.jumping;
        let crouch: number = players[0].status.crouching;
        let god: number   = players[0].status.god;
        let dead: number  = players[0].status.dead;

        players[0].status.god  = 0;
        players[0].status.dead = 0;

        // ── stats sub-object ───────────────────────────────────────────────
        let kills: number   = players[0].stats.actorsKilled;
        let secrets: number = players[0].stats.secretRooms;
        let total: number   = players[0].stats.totalKills;

        players[0].stats.actorsKilled = 0;
        players[0].stats.secretRooms  = 0;
        players[0].stats.totalKills   = 0;

        console.log("test_players_new OK");
    }
}
