import '../../include/TCSet100/types'
import DN3D from '../../include/TCSet100/DN3D/game';

class AssaultTrooper extends CActor {
    /* ─────────────────────────────────────────
    *  ACTIONS
    * ───────────────────────────────────────── */
    protected readonly actions: TAction<
        | 'aStand' | 'aGrow' | 'aStayStand'
        | 'aWalking' | 'aWalkingBack' | 'aRunning'
        | 'aShoot' | 'aJetpack' | 'aJetpackIll'
        | 'aFlintch' | 'aDying' | 'aDead'
        | 'aPlayDead' | 'aSufferDead' | 'aSuffering'
        | 'aDuck' | 'aDuckShoot' | 'aAboutHide'
        | 'aHide' | 'aReappear' | 'aFrozen'
    > = {
            aStand: { start: 0, length: 1, viewType: 5, incValue: 1, delay: 1 },
            aGrow: { start: 0, length: 1, viewType: 5, incValue: 1, delay: 1 },
            aStayStand: { start: -2, length: 1, viewType: 5, incValue: 1, delay: 1 },
            aWalking: { start: 0, length: 4, viewType: 5, incValue: 1, delay: 12 },
            aWalkingBack: { start: 15, length: 4, viewType: 5, incValue: -1, delay: 12 },
            aRunning: { start: 0, length: 4, viewType: 5, incValue: 1, delay: 8 },
            aShoot: { start: 35, length: 1, viewType: 5, incValue: 1, delay: 30 },
            aJetpack: { start: 40, length: 1, viewType: 5, incValue: 1, delay: 1 },
            aJetpackIll: { start: 40, length: 2, viewType: 5, incValue: 1, delay: 50 },
            aFlintch: { start: 50, length: 1, viewType: 1, incValue: 1, delay: 6 },
            aDying: { start: 50, length: 5, viewType: 1, incValue: 1, delay: 16 },
            aDead: { start: 54, length: 1, viewType: 5, incValue: 0, delay: 0 },
            aPlayDead: { start: 54, length: 1, viewType: 5, incValue: 0, delay: 0 },
            aSufferDead: { start: 58, length: 2, viewType: 1, incValue: -4, delay: 24 },
            aSuffering: { start: 59, length: 2, viewType: 1, incValue: 1, delay: 21 },
            aDuck: { start: 64, length: 1, viewType: 5, incValue: 1, delay: 3 },
            aDuckShoot: { start: 64, length: 2, viewType: 5, incValue: 1, delay: 25 },
            aAboutHide: { start: 74, length: 1, viewType: 1, incValue: 1, delay: 25 },
            aHide: { start: 79, length: 1, viewType: 1, incValue: 1, delay: 25 },
            aReappear: { start: 74, length: 1, viewType: 1, incValue: 1, delay: 25 },
            aFrozen: { start: 0, length: 1, viewType: 5, incValue: 0, delay: 0 },
        };


    /* ─────────────────────────────────────────
    *  MOVES
    * ───────────────────────────────────────── */
    protected readonly moves: TMove<
        | 'walkVels' | 'walkVelsBack'
        | 'jetpackVels' | 'jetpackIllVels'
        | 'runVels' | 'stopped'
        | 'dontGetUp' | 'shrunkVels'
    > = {
            walkVels: { horizontal_vel: 72, vertical_vel: 0 },
            walkVelsBack: { horizontal_vel: -72, vertical_vel: 0 },
            jetpackVels: { horizontal_vel: 64, vertical_vel: -84 },
            jetpackIllVels: { horizontal_vel: 192, vertical_vel: -38 },
            runVels: { horizontal_vel: 108, vertical_vel: 0 },
            stopped: { horizontal_vel: 0, vertical_vel: 0 },
            dontGetUp: { horizontal_vel: 0, vertical_vel: 0 },
            shrunkVels: { horizontal_vel: 32, vertical_vel: 0 },
        };


    /* ─────────────────────────────────────────
    *  AI CONFIGS
    * ───────────────────────────────────────── */
    protected readonly ais: TAi<
        | 'aiSeekEnemy' | 'aiSeekPlayer' | 'aiFleeing'
        | 'aiFleeingBack' | 'aiDodge' | 'aiShooting'
        | 'aiDucking' | 'aiJetpack' | 'aiShrunk'
        | 'aiHide' | 'aiGrow'
    > = {
            aiSeekEnemy: {
                action: 'aWalking',
                move: 'walkVels',
                flags: EMoveFlags.seekplayer,
            },
            aiSeekPlayer: {
                action: 'aWalking',
                move: 'walkVels',
                flags: EMoveFlags.seekplayer,
            },
            aiFleeing: {
                action: 'aWalking',
                move: 'walkVels',
                flags: EMoveFlags.fleeenemy,
            },
            aiFleeingBack: {
                action: 'aWalkingBack',
                move: 'walkVelsBack',
                flags: EMoveFlags.faceplayer,
            },
            aiDodge: {
                action: 'aWalking',
                move: 'runVels',
                flags: EMoveFlags.dodgebullet,
            },
            aiShooting: {
                action: 'aShoot',
                move: 'stopped',
                flags: EMoveFlags.faceplayer,
            },
            aiDucking: {
                action: 'aDuck',
                move: 'stopped',
                flags: EMoveFlags.faceplayer,
            },
            aiJetpack: {
                action: 'aJetpack',
                move: 'jetpackVels',
                flags: EMoveFlags.seekplayer,
            },
            aiShrunk: {
                action: 'aWalking',
                move: 'shrunkVels',
                flags: EMoveFlags.fleeenemy,
            },
            aiHide: {
                action: 'aAboutHide',
                move: 'stopped',
                flags: EMoveFlags.faceplayer,
            },
            aiGrow: {
                action: 'aGrow',
                move: 'dontGetUp',
                flags: EMoveFlags.faceplayerslow,
            },
        };


    constructor() {
        super(1680, true, 30);
    }

    Hide() {
        switch (this.curAction) {
            case this.actions.aReappear:
                if (this.curActionFrame >= 2) {
                    this.Sound(DN3D.ESound.TELEPORTER, false);
                    this.StartAI(this.ais.aiShooting);
                    this.CStat(EStats.BLOCK | EStats.BLOCK_HITSCAN);
                } else {
                    this.SizeTo(41, 40, 4, 4);
                    this.Spawn(DN3D.ENames.FRAMEEFFECT1);
                }
                break;

            case this.actions.aWalking:
                if (this.playerDist < 2448 && this.playerDist > 1024) {
                    if (this.CeilingDist() < 48 || IsPlayerState(EPlayerStates.facing))
                        this.Stop();

                    if (this.GapDist() >= 48 && this.IsAwayFromWall()) {
                        this.Spawn(DN3D.ENames.TRANSPORTERSTAR);
                        this.PlayAction(this.actions.aReappear);
                        this.Move(null, 0);
                        this.Stop();
                    }
                }
                break;

            case this.actions.aHide:
                if (this.curActionFrame >= 2) {
                    this.Spawn(DN3D.ENames.TRANSPORTERSTAR);
                    this.Sound(DN3D.ESound.TELEPORTER, false);
                    this.PlayAction(this.actions.aWalking);
                    this.Move(this.moves.walkVels, EMoveFlags.faceplayer);
                    this.CStat(EStats.INVISIBLE);
                } else {
                    this.SizeTo(41, 40, 4, 4);
                    this.Spawn(DN3D.ENames.FRAMEEFFECT1);
                }
                break;

            case this.actions.aAboutHide:
                if (this.curActionFrame >= 2) {
                    this.PlayAction(this.actions.aHide);
                    this.CStat(0);
                }
                break;
        }
    }

    GonnaShoot() {
        if (IsPlayerState(EPlayerStates.alive)) {
            if (this.playerDist < 1024)
                this.StartAI(this.ais.aiShooting)
            else if (!(this.flags & ESpriteFlags.BADGUYSTAYPUT)) {
                if (this.curActionFrame >= 12
                    && this.IsRandom(16)
                    && this.CanShootTarget()
                ) {
                    if (this.pal == 21
                        && this.IsRandom(4)
                        && this.playerDist >= 4096
                    )
                        this.StartAI(this.ais.aiHide)
                    else {
                        if (this.playerDist < 1100)
                            this.StartAI(this.ais.aiFleeing)
                        else {
                            if (this.playerDist < 4096
                                && this.CanSee()
                                && this.CanShootTarget()
                            )
                                this.StartAI(this.ais.aiShooting)
                            else {
                                this.Move(this.moves.runVels, EMoveFlags.seekplayer);
                                this.PlayAction(this.actions.aRunning);
                            }
                        }
                    }
                }
            } else {
                if(this.Count() >= 26 && this.IsRandom(32))
                    this.StartAI(this.ais.aiShooting);
            }
        }
    }

    Seek() {
        this.GonnaShoot();

        if(this.IsInWater()) {
            this.StartAI(this.ais.aiJetpack);
            this.Stop();
        }

        if(this.CanSee()) {
            if(this.curMove == this.moves.runVels && this.playerDist < 1596)
                this.StartAI(this.ais.aiDucking);
        }
    }

    Main() {

    }
}