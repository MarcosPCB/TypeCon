import '../include/TCSet100/types'
import DN3D from '../include/TCSet100/DN3D/game';

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
            aDead: { start: 54, length: 1, viewType: 1, incValue: 0, delay: 0 },
            aPlayDead: { start: 54, length: 1, viewType: 1, incValue: 0, delay: 0 },
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
                action: this.actions.aWalking,
                move: this.moves.walkVels,
                flags: EMoveFlags.seekplayer,
            },
            aiSeekPlayer: {
                action: this.actions.aWalking,
                move: this.moves.walkVels,
                flags: EMoveFlags.seekplayer,
            },
            aiFleeing: {
                action: this.actions.aWalking,
                move: this.moves.walkVels,
                flags: EMoveFlags.fleeenemy,
            },
            aiFleeingBack: {
                action: this.actions.aWalkingBack,
                move: this.moves.walkVelsBack,
                flags: EMoveFlags.faceplayer,
            },
            aiDodge: {
                action: this.actions.aWalking,
                move: this.moves.runVels,
                flags: EMoveFlags.dodgebullet,
            },
            aiShooting: {
                action: this.actions.aShoot,
                move: this.moves.stopped,
                flags: EMoveFlags.faceplayer,
            },
            aiDucking: {
                action: this.actions.aDuck,
                move: this.moves.stopped,
                flags: EMoveFlags.faceplayer,
            },
            aiJetpack: {
                action: this.actions.aJetpack,
                move: this.moves.jetpackVels,
                flags: EMoveFlags.seekplayer,
            },
            aiShrunk: {
                action: this.actions.aWalking,
                move: this.moves.shrunkVels,
                flags: EMoveFlags.fleeenemy,
            },
            aiHide: {
                action: this.actions.aAboutHide,
                move: this.moves.stopped,
                flags: EMoveFlags.faceplayer,
            },
            aiGrow: {
                action: this.actions.aGrow,
                move: this.moves.dontGetUp,
                flags: EMoveFlags.faceplayerslow,
            },
        };


    /**
     * Assault Trooper constructor
     * Extends CActor class and allows for proper definition of the actor
     */
    constructor() {
        /**
         * The first parameter is the actor's tile number
         * The second parameter tells if its and enemy or not
         * The third parameter is the actor's strength
         * The fourth arguments makes the label declarations be kept in memory (Actions, AIs and Moves)
         * The fifth parameter tells the compiler that the actor has hard-coded stuff (replaces 'useractor' to 'actor')
         */
        super(DN3D.ENames.LIZTROOP, true, 30, false, true);
    }

    Hide() {
        switch (this.curAction) {
            /**
             * Use the .loc property to get the action's pointer for comparison
             */
            case this.actions.aReappear.loc:
                if (this.ActionCount() >= 2) {
                    /**
                     * Notice that the list of sounds used by DN3D is inside the DN3D module
                     * together with all the other constants and states
                     */
                    this.Sound(DN3D.ESound.TELEPORTER);
                    this.StartAI(this.ais.aiShooting);
                    /**
                     * EStats contains all the possible stats for the actor
                     */
                    this.CStat(EStats.BLOCK | EStats.BLOCK_HITSCAN);
                } else {
                    /**
                     * SizeTo allows you to dictate the actor's size increment
                     */
                    this.SizeTo(41, 40, 4, 4);
                    /**
                     * DN3D.ENames is a enum list of all actor definitions of Duke 3D
                     */
                    this.Spawn(DN3D.ENames.FRAMEEFFECT1);
                }
                break;

            case this.actions.aWalking.loc:
                if (this.playerDist < 2448 && this.playerDist > 1024) {
                    /**
                     * EPlayerStates holds all possible values of the current player state
                     */
                    if (this.CeilingDist() < 48 || IsPlayerState(EPlayerStates.facing))
                        return;

                    if (this.GapDist() >= 48 && this.IsAwayFromWall()) {
                        this.Spawn(DN3D.ENames.TRANSPORTERSTAR);
                        /**
                         * Instead of sending two different commands to se the action and the move,
                         * you can use ActionAndMove, that already does that you, making the code cleaner
                         * In this case we se the move to null and its move flags to 0
                         */
                        ActionAndMove(this.actions.aReappear, null, 0);
                        return;
                    }
                }
                break;

            case this.actions.aHide.loc:
                if (this.ActionCount() >= 2) {
                    this.Spawn(DN3D.ENames.TRANSPORTERSTAR);
                    this.Sound(DN3D.ESound.TELEPORTER);
                    /**
                     * This another example sets the move to walkVels and the move flags to faceplayer
                     */
                    ActionAndMove(this.actions.aWalking, this.moves.walkVels, EMoveFlags.faceplayer)
                    this.CStat(EStats.INVISIBLE);
                } else {
                    this.SizeTo(4, 40, 4, 4);
                    this.Spawn(DN3D.ENames.FRAMEEFFECT1);
                }
                break;

            case this.actions.aAboutHide.loc:
                if (this.ActionCount() >= 2) {
                    this.PlayAction(this.actions.aHide);
                    this.CStat(0);
                }
                break;
        }
    }

    GonnaShoot() {
        if (!IsPlayerState(EPlayerStates.alive))
            return;

        if (this.playerDist < 1024)
            this.StartAI(this.ais.aiShooting)
        /**
         * Here we check the actor's flags to see if it's a stayput enemy
         */
        else if (!(this.flags & ESpriteFlags.BADGUYSTAYPUT)) {
            /**
             * isRandom is the same as ifrnd
             */
            if (this.ActionCount() >= 12 && this.IsRandom(16) && this.CanShootTarget()) {
                if (this.pal == 21 && this.IsRandom(4) && this.playerDist > 4096)
                    this.StartAI(this.ais.aiHide)
                else {
                    if (this.playerDist < 1100)
                        this.StartAI(this.ais.aiFleeing)
                    else {
                        if (CanSeeShootInDist(4096, false))
                            this.StartAI(this.ais.aiShooting)
                        else
                            ActionAndMove(this.actions.aRunning, this.moves.runVels, EMoveFlags.seekplayer);
                    }
                }
            }
        } else if(this.Count() >= 26 && this.IsRandom(32))
                this.StartAI(this.ais.aiShooting);
    }

    Seek() {
        this.GonnaShoot();

        if(this.IsInWater()) {
            this.StartAI(this.ais.aiJetpack);
            return;
        }

        if(this.CanSee()) {
            if(this.curMove == this.moves.runVels.loc && this.playerDist < 1596)
                this.StartAI(this.ais.aiDucking);

            if(IsPlayerState(EPlayerStates.higher)) {
                if(this.CeilingDist() > 128 && !(this.flags & ESpriteFlags.BADGUYSTAYPUT))
                    this.StartAI(this.ais.aiJetpack);

                return;
            } else if(this.IsRandom(2)) {
                if(this.pal == 21 && this.playerDist >= 1596) {
                    this.StartAI(this.ais.aiHide);
                    return;
                }

                if(this.BulletNear()) {
                    if(this.IsRandom(128))
                        this.StartAI(this.ais.aiDodge);
                    else
                        this.StartAI(this.ais.aiDucking);

                    return;
                }
            }
        }

        if(!this.IsItMoving()) {
            if(this.IsRandom(32))
                /**
                 * One command to rule them all!
                 * Operate allows the actor to oeprate not only doors, but sectors and switches.
                 * Which means, that instead of a Operate command for each type of interaction,
                 * you get to use only one now.
                 */
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
                /**
                 * Sound allows you to play sounds globally, once (soundonce) or normally.
                 */
                this.Sound(DN3D.ESound.PRED_ROAM, false, true);
            else
                this.Sound(DN3D.ESound.PRED_ROAM2, false, true);
        }
    }

    Duck() {
        if(this.curAction == this.actions.aDuck.loc) {
            if(this.ActionCount() >= 8) {
                if(IsPlayerState(EPlayerStates.alive)) {
                    if(this.IsRandom(128))
                        this.PlayAction(this.actions.aDuckShoot)
                } else if(this.curMove == this.moves.dontGetUp.loc) return;
                else this.StartAI(this.ais.aiSeekPlayer)
            }
        } else if(this.curAction == this.actions.aDuckShoot.loc) {
            if(this.Count() >= 64) {
                if(this.curMove == this.moves.dontGetUp.loc)
                    this.Count(0);
                else {
                    if(this.playerDist <= 1100)
                        this.StartAI(this.ais.aiFleeing);
                    else this.StartAI(this.ais.aiSeekPlayer);
                }
            } else if(this.ActionCount() >= 2) {
                if(this.CanShootTarget()) {
                    this.Sound(DN3D.ESound.PRED_ATTACK);
                    this.ResetAction();
                    this.Shoot(DN3D.ENames.FIRELASER);
                } else
                    this.StartAI(this.ais.aiSeekPlayer);
            }
        }
    }

    Shooting() {
        if(this.ActionCount() >= 2) {
            if(this.CanShootTarget()) {
                this.Shoot(DN3D.ENames.FIRELASER);
                this.Sound(DN3D.ESound.PRED_ATTACK);
                this.ResetAction();

                if(this.IsRandom(128))
                    this.StartAI(this.ais.aiSeekPlayer);

                /**
                 * Count and ActionCount are methods that allow you to
                 * get the current actor's count and set it to a new value
                 */
                if(this.Count() >= 24) {
                    if(this.IsRandom(96) && this.playerDist >= 2048)
                        this.StartAI(this.ais.aiSeekPlayer);
                    else {
                        if(this.playerDist > 1596)
                            this.StartAI(this.ais.aiFleeing);
                        else this.StartAI(this.ais.aiFleeingBack);
                    }
                }
            } else
                this.StartAI(this.ais.aiSeekPlayer);
        }
    }

    Flee() {
        if(this.ActionCount() >= 7) {
            if(this.playerDist >= 3084) {
                this.StartAI(this.ais.aiSeekPlayer);
                return;
            } else if(this.IsRandom(32)
                && IsPlayerState(EPlayerStates.alive)
                && this.CanSee()
                && this.CanShootTarget()) {
                    if(this.IsRandom(128))
                        this.StartAI(this.ais.aiDucking);
                    else
                        this.StartAI(this.ais.aiShooting);
                    return;
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
            if(this.ActionCount() >= 5) {
                this.CStat(0);
                if(this.FloorDist() <= 8)
                    this.Sound(DN3D.ESound.THUD);
                if(this.IsRandom(64))
                    this.Spawn(DN3D.ENames.BLOODPOOL);
                DN3D.states.RF();
                this.extra = 0;
                ActionAndMove(this.actions.aDead, null, 0);
            }
            return;
        } else {
            DN3D.states.RF();
            ActionAndMove(this.actions.aDying, null, 0);
        }
    }

    ExplodeBody() {
        this.Sound(DN3D.ESound.SQUISHED, false);
        DN3D.states.TroopBodyJibs();
        DN3D.states.StandardJibs();
        this.KillIt();
    }

    CheckHit() {
        if(this.curAction == this.actions.aSuffering.loc) {
            this.StopSound(DN3D.ESound.LIZARD_BEG);
            this.Sound(DN3D.ESound.PRED_DYING);
            this.CStat(0);
            this.extra = 0;
            this.PlayAction(this.actions.aPlayDead);
            return;
        }

        if(this.IsDead()) {
            if(this.weaponHit == DN3D.ENames.FREEZEBLAST) {
                this.Sound(DN3D.ESound.SOMETHINGFROZE);
                this.Pal(1);
                ActionAndMove(this.actions.aFrozen, null, 0);
                this.extra = 0;
                return;
            }

            /**
             * DropAmmo and RandomWallJibs are methods that are linked
             * to the CON native states inside GAME.CON
             */
            DN3D.states.DropAmmo();
            DN3D.states.RandomWallJibs();

            if(this.weaponHit == DN3D.ENames.GROWSPARK) {
                this.CStat(0);
                this.Sound(DN3D.ESound.ACTOR_GROWING);
                this.StartAI(this.ais.aiGrow);
                return;
            }

            this.AddKills(1);

            if(this.weaponHit == DN3D.ENames.RPG || this.weaponHit == DN3D.ENames.RADIUSEXPLOSION)
                this.ExplodeBody();
            else {
                this.Sound(DN3D.ESound.PRED_DYING);
                if(this.IsRandom(32) && this.FloorDist() <= 32) {
                    this.Sound(DN3D.ESound.LIZARD_BEG);
                    this.Spawn(DN3D.ENames.BLOODPOOL);
                    this.extra = 0;
                    ActionAndMove(this.actions.aSuffering, null, 0);
                    return;
                }

                this.PlayAction(this.actions.aDying);
                return;
            }
        } else {
            DN3D.states.RandomWallJibs();
            this.Sound(DN3D.ESound.PRED_PAIN, false);

            if(this.weaponHit == DN3D.ENames.SHRINKSPARK) {
                this.Sound(DN3D.ESound.ACTOR_SHRINKING);
                this.StartAI(this.ais.aiShrunk);
            } else if(this.weaponHit == DN3D.ENames.GROWSPARK)
                this.Sound(DN3D.ESound.EXPANDERHIT, false);
            else if(this.FloorDist() <= 32 && this.IsRandom(96))
                this.PlayAction(this.actions.aFlintch);
        }
    }

    Jetpack() {
        if(this.curAction == this.actions.aJetpackIll.loc) {
            if(this.CanSee() && this.ActionCount() >= 2) {
                this.ResetAction();
                this.Sound(DN3D.ESound.PRED_ATTACK);
                this.Shoot(DN3D.ENames.FIRELASER);
            }

            if(IsPlayerState(EPlayerStates.higher) || this.IsInWater())
                this.StartAI(this.ais.aiJetpack);
            else if(this.Count() >= 26 && this.FloorDist() < 26)
                this.StartAI(this.ais.aiSeekPlayer);
        } else if(this.Count() >= 48 && this.CanSee())
            ActionAndMove(this.actions.aJetpackIll, this.moves.jetpackIllVels, EMoveFlags.seekplayer);
    }

    Suffering() {
        if(this.ActionCount() < 2)
            return;

        if(this.IsRandom(16))
            this.Spawn(DN3D.ENames.WATERDRIP);

        if(this.ActionCount() < 14)
            return;

        this.StopSound(DN3D.ESound.LIZARD_BEG);
        this.CStat(0);
        this.extra = 0;
        this.PlayAction(this.actions.aSufferDead);
        return;
    }

    Shrunk() {
        if(this.Count() >= DN3D.shrunkDoneCount)
            this.StartAI(this.ais.aiSeekPlayer);
        else if(this.Count() >= DN3D.shrunkCount)
            this.SizeTo(48, 40, 1, 1);
        else
            DN3D.states.GenericShrunkCode();
    }

    CheckPal() {
        if(this.curAI == null) {
            if(this.pal == 0)
                return;
            if(this.pal == 21)
                this.extra *= 2;
        }
    }

    Main(first_action = this.actions.aStand) {
        this.CheckPal();
        this.Fall();

        if(this.IsInWater() && this.IsRandom(1))
            this.Spawn(DN3D.ENames.WATERBUBBLE);

        switch(this.curAction) {
            case this.actions.aStand.loc:
                if(this.IsRandom(192))
                    this.StartAI(this.ais.aiShooting);
                else
                    this.StartAI(this.ais.aiSeekPlayer);
                break;

            case this.actions.aFrozen.loc:
                if(this.Count() >= DN3D.thawTime) {
                    this.StartAI(this.ais.aiSeekEnemy);
                    this.GetLastPal();
                } else if(this.Count() >= DN3D.frozenDripTime && this.ActionCount() >= 26) {
                    this.Spawn(DN3D.ENames.WATERDRIP);
                    this.ResetAction();
                }

                if(this.HitByWeapon()) {
                    if(this.weaponHit == DN3D.ENames.FREEZEBLAST) {
                        this.extra = 0;
                        return;
                    }

                    this.AddKills(1);
                    if(this.IsRandom(84))
                        this.Spawn(DN3D.ENames.BLOODPOOL);

                    this.Glass(30);
                    this.Sound(DN3D.ESound.GLASS_BREAKING, false);
                    this.KillIt();
                }

                if(this.playerDist <= DN3D.frozenQuickKickDist && IsPlayerState(EPlayerStates.facing))
                    this.PlayerKick();

                break;

            case this.actions.aPlayDead.loc:
                if(this.HitByWeapon()) {
                    if(this.weaponHit == DN3D.ENames.RADIUSEXPLOSION)
                        this.ExplodeBody();
                    return;
                } else
                    DN3D.states.CheckSquished();

                if(this.Count() >= DN3D.playDeadTime) {
                    this.AddKills(-1);
                    this.Sound(DN3D.ESound.PRED_ROAM, false, true);
                    this.CStat(EStats.BLOCK | EStats.BLOCK_HITSCAN);
                    this.extra = 1;
                    this.StartAI(this.ais.aiShooting);
                } else if(IsPlayerState(EPlayerStates.facing))
                    this.Count(0);

                return;

            case this.actions.aDead.loc:
                this.extra = 0;

                if(IsRespawnActive() && this.Count() >= DN3D.respawnActorTime) {
                    this.Spawn(DN3D.ENames.TRANSPORTERSTAR);
                    this.CStat(EStats.BLOCK | EStats.BLOCK_HITSCAN);
                    this.extra = this.defaultStrength;
                    this.StartAI(this.ais.aiSeekPlayer);
                }

                if(this.HitByWeapon()) {
                    if(this.weaponHit == DN3D.ENames.RADIUSEXPLOSION)
                        this.ExplodeBody();
                } else
                    DN3D.states.CheckSquished();

                return;

            case this.actions.aSufferDead.loc:
                if(this.ActionCount() >= 2) {
                    if(this.IsRandom(64)) {
                        this.Count(0);
                        this.PlayAction(this.actions.aPlayDead);
                    } else {
                        this.Sound(DN3D.ESound.PRED_DYING, false, true);
                        this.PlayAction(this.actions.aDead);
                    }
                }

                break;

            case this.actions.aDying.loc:
                this.Dying();
                return;

            case this.actions.aSuffering.loc:
                this.Suffering();
                if(this.HitByWeapon())
                    this.CheckHit();

                break;

            case this.actions.aFlintch.loc:
                if(this.ActionCount() >= 4)
                    this.StartAI(this.ais.aiSeekEnemy);

                return;

            default:
                switch(this.curAI) {
                    case this.ais.aiSeekPlayer.loc:
                    case this.ais.aiSeekEnemy.loc:
                    case this.ais.aiDodge.loc:
                        this.Seek();
                        break;

                    case this.ais.aiJetpack.loc:
                        this.Jetpack();
                        if(!this.IsInWater())
                            this.Sound(DN3D.ESound.DUKE_JETPACK_IDLE, false, true);
                        break;

                    case this.ais.aiShooting.loc:
                        this.Shooting();
                        break;

                    case this.ais.aiFleeing.loc:
                    case this.ais.aiFleeingBack.loc:
                        this.Flee();
                        break;

                    case this.ais.aiDucking.loc:
                        this.Duck();
                        break;

                    case this.ais.aiShrunk.loc:
                        this.Shrunk();
                        break;

                    case this.ais.aiGrow.loc:
                        DN3D.states.GenericGrowCode();
                        break;
                    
                    case this.ais.aiHide.loc:
                        this.Hide();
                        return;
                }
                break;
        }

        if(this.HitByWeapon())
            this.CheckHit();
        else
            DN3D.states.CheckSquished();
    }

    /** 
     * Here are the actor's variations of starting poses and states
     * The method must return the picnum, the strength and maybe its first action to be executed.
     * What happens is that after this execution,
     * it returns to the Main method of the actor
    */
    protected Variations: OnVariation<AssaultTrooper> = {
        OnJetpack(this: AssaultTrooper) {
            this.CheckPal();
            this.StartAI(this.ais.aiJetpack);
            this.picnum = this.defaultPicnum;
            return {
                picnum: DN3D.ENames.LIZTROOPJETPACK,
                extra: this.defaultStrength
            }
        },
        OnDuck(this: AssaultTrooper) {
            this.CheckPal();
            this.StartAI(this.ais.aiDucking);
            this.picnum = this.defaultPicnum;
            if(this.GapDist() < 48)
                this.Move(this.moves.dontGetUp, 0);
            return {
                picnum: DN3D.ENames.LIZTROOPDUCKING,
                extra: this.defaultStrength
            }
        },
        OnShoot(this: AssaultTrooper) {
            this.CheckPal();
            this.StartAI(this.ais.aiShooting);
            this.picnum = this.defaultPicnum;
            return {
                picnum: DN3D.ENames.LIZTROOPSHOOT,
                extra: this.defaultStrength,
                first_action: this.actions.aStand
            }
        },
        onStayput(this: AssaultTrooper) {
            this.flags |= ESpriteFlags.BADGUYSTAYPUT;
            this.CheckPal();
            this.StartAI(this.ais.aiSeekPlayer);
            this.picnum = this.defaultPicnum;
            return {
                picnum: DN3D.ENames.LIZTROOPSTAYPUT,
                extra: this.defaultStrength,
                first_action: this.actions.aStayStand
            }
        },
        OnRunning(this: AssaultTrooper) {
            this.CheckPal();
            this.StartAI(this.ais.aiSeekPlayer);
            this.picnum = this.defaultPicnum;
            return {
                picnum: DN3D.ENames.LIZTROOPRUNNING,
                extra: this.defaultStrength,
                first_action: this.actions.aStand 
            }
        },
        OnToilet(this: AssaultTrooper) {
            if(this.Count() >= 24) {
                this.Sound(DN3D.ESound.FLUSH_TOILET);
                this.Operate(EOperateFlags.doors);
                this.StartAI(this.ais.aiSeekPlayer);
                this.picnum = this.defaultPicnum;
            } else if(this.Count() < 2)
                this.CheckPal();

            return {
                picnum: DN3D.ENames.LIZTROOPONTOILET,
                extra: this.defaultStrength
            }
        },
        JustSit(this: AssaultTrooper) {
            if(this.Count() >= 30) {
                this.Operate(EOperateFlags.doors);
                this.StartAI(this.ais.aiSeekPlayer);
                this.picnum = this.defaultPicnum;
            } else if(this.Count() < 2)
                this.CheckPal();

            return {
                picnum: DN3D.ENames.LIZTROOPJUSTSIT,
                extra: this.defaultStrength
            }
        }
    }
}