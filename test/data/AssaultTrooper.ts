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

            if(IsPlayerState(EPlayerStates.higher)) {
                if(this.CeilingDist() > 128 && !(this.flags & ESpriteFlags.BADGUYSTAYPUT))
                    this.StartAI(this.ais.aiJetpack);
                this.Stop();
            } else if(this.IsRandom(2)) {
                if(this.pal == 21 && this.playerDist >= 1596) {
                    this.StartAI(this.ais.aiHide);
                    this.Stop();
                }

                if(this.BulletNear()) {
                    if(this.IsRandom(128))
                        this.StartAI(this.ais.aiDodge);
                    else this.StartAI(this.ais.aiDucking);

                    this.Stop();
                }
            }
        }

        if(!this.IsItMoving()) {
            if(this.IsRandom(32))
                this.Operate(EOperateFlags.doors)
            else if(this.Count() >= 32
                && IsPlayerState(EPlayerStates.alive)
                && this.CanSee()
                && this.CanShootTarget()
            )
                this.StartAI(this.ais.aiShooting);
        }

        if(this.IsRandom(1)) {
            if(this.IsRandom(128))
                this.Sound(DN3D.ESound.PRED_ROAM, false, true);
            else this.Sound(DN3D.ESound.PRED_ROAM2, false, true);
        }
    }

    Duck() {
        if(this.curAction == this.actions.aDuck) {
            if(this.curActionFrame >= 8) {
                if(IsPlayerState(EPlayerStates.alive)) {
                    if(this.IsRandom(8))
                        this.PlayAction(this.actions.aDuckShoot)
                } else if(this.curMove == this.moves.dontGetUp)
                    this.Stop();
                else this.StartAI(this.ais.aiSeekPlayer)
            }
        } else if(this.curAction == this.actions.aDuckShoot) {
            if(this.Count() >= 64) {
                if(this.curMove == this.moves.dontGetUp)
                    this.Count(0);
                else {
                    if(this.playerDist < 1100)
                        this.StartAI(this.ais.aiFleeing);
                    else this.StartAI(this.ais.aiSeekPlayer);
                }
            } else if(this.curActionFrame >= 2) {
                if(this.CanShootTarget()) {
                    this.Sound(DN3D.ESound.PRED_ATTACK, false);
                    this.ResetAction();
                    this.Shoot(DN3D.ENames.FIRELASER);
                } else this.StartAI(this.ais.aiSeekPlayer);
            }
        }
    }

    Shooting() {
        if(this.curActionFrame >= 2) {
            if(this.CanShootTarget()) {
                this.Shoot(DN3D.ENames.FIRELASER);
                this.Sound(DN3D.ESound.PRED_ATTACK, false);
                this.ResetAction();

                if(this.IsRandom(128))
                    this.StartAI(this.ais.aiSeekPlayer);

                if(this.Count() >= 24) {
                    if(this.IsRandom(96) && this.playerDist >= 2048)
                        this.StartAI(this.ais.aiSeekPlayer);
                    else {
                        if(this.playerDist > 1596)
                            this.StartAI(this.ais.aiFleeing);
                        else this.StartAI(this.ais.aiFleeingBack);
                    }
                }
            } else this.StartAI(this.ais.aiSeekPlayer);
        }
    }

    Flee() {
        if(this.curActionFrame >= 7) {
            if(this.playerDist >= 3084) {
                this.StartAI(this.ais.aiSeekPlayer);
                this.Stop();
            } else if(this.IsRandom(32)
                && IsPlayerState(EPlayerStates.alive)
                && this.CanSee()
                && this.CanShootTarget()) {
                    if(this.IsRandom(128))
                        this.StartAI(this.ais.aiDucking);
                    else
                        this.StartAI(this.ais.aiShooting);
                    this.Stop();
                }
        }

        if(!this.IsItMoving()) {
            if(this.IsRandom(32))
                this.Operate(EOperateFlags.doors);
            else if(this.Count() >= 32
                && IsPlayerState(EPlayerStates.alive)
                && this.CanSee()
                && this.CanShootTarget()) {
                    if(this.IsRandom(128))
                        this.StartAI(this.ais.aiDucking);
                    else
                        this.StartAI(this.ais.aiShooting);
            }
        }
    }

    Dying() {
        if(this.FloorDist() <= 32) {
            if(this.curActionFrame >= 5) {
                this.CStat(0);
                if(this.FloorDist() <= 8)
                    this.Sound(DN3D.ESound.THUD, false);
                if(this.IsRandom(64))
                    this.Spawn(DN3D.ENames.BLOODPOOL);
                DN3D.states.RF();
                this.extra = 0;
                this.Move(this.moves.stopped, 0);
                this.PlayAction(this.actions.aDead);
            }
            this.Stop();
        } else {
            DN3D.states.RF();
            this.Move(null, 0);
            this.PlayAction(this.actions.aDying);
        }
    }

    CheckHit() {
        if(this.curAction == this.actions.aSuffering) {
            this.StopSound(DN3D.ESound.LIZARD_BEG);
            this.Sound(DN3D.ESound.PRED_DYING, false);
            this.CStat(0);
            this.extra = 0;
            this.PlayAction(this.actions.aPlayDead);
            this.Stop();
        }

        if(this.IsDead()) {
            if(this.weaponHit == DN3D.ENames.FREEZEBLAST) {
                this.Sound(DN3D.ESound.SOMETHINGFROZE, false);
                this.Pal(1);
                this.Move(null, 0);
                this.PlayAction(this.actions.aFrozen);
                this.extra = 0;
                this.Stop();
            }

            DN3D.states.DropAmmo();
            DN3D.states.RandomWallJibs();

            if(this.weaponHit == DN3D.ENames.GROWSPARK) {
                this.CStat(0);
                this.Sound(DN3D.ESound.ACTOR_GROWING, false);
                this.StartAI(this.ais.aiGrow);
                this.Stop();
            }

            this.AddKills(1);

            if(this.weaponHit == DN3D.ENames.RPG || this.weaponHit == DN3D.ENames.RADIUSEXPLOSION) {
                this.Sound(DN3D.ESound.SQUISHED, false);
                DN3D.states.TroopBodyJibs();
                DN3D.states.StandardJibs();
                this.KillIt();
            } else {
                this.Sound(DN3D.ESound.PRED_DYING, false);
                if(this.IsRandom(32) && this.FloorDist() <= 32) {
                    this.Sound(DN3D.ESound.LIZARD_BEG, false);
                    this.Spawn(DN3D.ENames.BLOODPOOL);
                    this.extra = 0;
                    this.Move(null, 0);
                    this.PlayAction(this.actions.aSuffering);
                    this.Stop();
                }

                this.PlayAction(this.actions.aDying);
                this.Stop();
            }
        } else {
            DN3D.states.RandomWallJibs();
            this.Sound(DN3D.ESound.PRED_PAIN, false);

            if(this.weaponHit == DN3D.ENames.SHRINKSPARK) {
                this.Sound(DN3D.ESound.ACTOR_SHRINKING, false);
                this.StartAI(this.ais.aiShrunk);
            } else if(this.weaponHit == DN3D.ENames.GROWSPARK)
                this.Sound(DN3D.ESound.EXPANDERHIT, false);
            else if(this.FloorDist() <= 32 && this.IsRandom(96))
                this.PlayAction(this.actions.aFlintch);
        }
    }

    Troop() {
        this.Fall();
    }

    Main() {

    }
}