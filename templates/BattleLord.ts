import '../include/TCSet100/types';
import DN3D from '../include/TCSet100/DN3D/game';

class BattleLord extends CActor {
    protected readonly actions: TAction<
        'walk' | 'frozen' | 'run' | 'shoot' | 'lob' | 'dying' | 'flintch' | 'dead' 
    > = {
        walk: { start: 0, length: 4, viewType: 5, incValue: 1, delay: 12 },
        frozen: { start: 30, length: 1, viewType: 5, incValue: 0, delay: 0 },
        run: { start: 0, length: 6, viewType: 5, incValue: 1, delay: 5 },
        shoot: { start: 30, length: 2, viewType: 5, incValue: 1, delay: 4 },
        lob: { start: 40, length: 2, viewType: 5, incValue: 1, delay: 35 },
        dying: { start: 50, length: 5, viewType: 1, incValue: 1, delay: 50 },
        flintch: { start: 50, length: 1, viewType: 1, incValue: 1, delay: 1 },
        dead: { start: 55, length: 1, viewType: 1, incValue: 0, delay: 0 },
    };

    protected readonly moves: TMove<
        'palShrunk' | 'palRun' | 'walk' | 'run' | 'stopped'
    > = {
        palShrunk: { horizontal_vel: 32, vertical_vel: 0 },
        palRun: { horizontal_vel: 128, vertical_vel: 0 },
        walk: { horizontal_vel: 208, vertical_vel: 0 },
        run: { horizontal_vel: 296, vertical_vel: 0 },
        stopped: { horizontal_vel: 0, vertical_vel: 0 },
    };

    protected readonly ais: TAi<
        'seek' | 'run' | 'shoot' | 'lobbed' | 'dying' | 'palShrink'
    > = {
        seek: { action: this.actions.walk, move: this.moves.walk, flags: EMoveFlags.seekplayer },
        run: { action: this.actions.run, move: this.moves.run, flags: EMoveFlags.faceplayer },
        shoot: { action: this.actions.shoot, move: this.moves.stopped, flags: EMoveFlags.faceplayer },
        lobbed: { action: this.actions.lob, move: this.moves.stopped, flags: EMoveFlags.faceplayer },
        dying: { action: this.actions.dying, move: this.moves.stopped, flags: EMoveFlags.faceplayer },
        palShrink: { action: this.actions.walk, move: this.moves.palShrunk, flags: EMoveFlags.furthestdir },
    };

    /**
     * BattleLord constructor
     * Extends CActor class and allows for proper definition of the actor
     * @param {number} tileNum - The tile number of the actor in the game.
     * @param {boolean} is_badguy - Whether the actor is an enemy or not.
     * @param {number} strength - The strength of the actor.
     * @param {boolean} no_labelobj - Whether to create label objects or not.
     * @param {boolean} is_hardcoded_badguy - Whether the actor is a hard-coded enemy.
     */
    constructor() {
        super(DN3D.ENames.BOSS1, true, 4500, false, true);
    }

    /**
     * Called when the actor is shrunk.
     * @description
     * If the actor has finished shrinking, switch to the seek AI.
     * If not, shrink the actor and continue to the generic shrink code.
     * @function
     */
    PalShrunk() {
        if(this.Count() >= DN3D.shrunkDoneCount)
            this.StartAI(this.ais.seek);
        else if(this.Count() >= DN3D.shrunkCount)
            this.SizeTo(48, 40, 1, 1);
        else
            DN3D.states.GenericShrunkCode();
    }
    /**
     * Check if the actor has a pallete adn chage its movement velocity
     */
    CheckSeek() {
        this.StartAI(this.ais.seek);
        if(this.pal)
            this.Move(this.moves.palRun, EMoveFlags.seekplayer);
    }

    /**
     * Called when the actor is in the run AI.
     * @description
     * If the player is within a certain distance, switch to the shoot AI.
     * If the player is in sight, shoot at him.
     * If not, switch to the seek AI.
     * @function
     */
    Run() {
        if(this.playerDist < 2048) {
            if(IsPlayerState(EPlayerStates.alive))
                this.StartAI(this.ais.shoot)
            return;
        } else if(this.CanSee()) {
            if(this.ActionCount() >= 6) {
                if(this.CanShootTarget()) {
                    this.ResetAction();
                    this.Sound(DN3D.ESound.BOS1_WALK);
                } else
                    this.StartAI(this.ais.seek);
            }
        } else 
            this.StartAI(this.ais.seek);
    }

    /**
     * Called when the actor is in the seek AI.
     * @description
     * Plays a sound effect if a random number is less than 2.
     * Resets the action counter and plays a sound effect if the action counter is greater than or equal to 6.
     * If the player is within a certain distance, switches to the shoot AI.
     * If the player is in sight, switches to the shoot AI if a random number is less than 32.
     * If the player is not in sight, switches to the lobbed AI if a random number is less than 192 and the player is within a certain distance.
     * @function
     */
    Seek() {
        if(this.IsRandom(2))
            this.Sound(DN3D.ESound.BOS1_ROAM);
        else if(this.ActionCount() >= 6) {
            this.ResetAction();
            this.Sound(DN3D.ESound.BOS1_WALK);
        }

        if(this.playerDist < 2548 && IsPlayerState(EPlayerStates.alive)) {
            this.StartAI(this.ais.shoot);
            return;
        }

        if(this.CanSee() && this.Count() >= 32) {
            if(this.IsRandom(32)) {
                if(IsPlayerState(EPlayerStates.alive) && this.CanShootTarget())
                    this.StartAI(this.ais.shoot);
            } else if(this.playerDist >= 2548 && this.IsRandom(192) && this.CanShootTarget()) {
                if(this.IsRandom(64)) {
                    this.StartAI(this.ais.run);
                    if(this.pal)
                        this.Move(this.moves.palRun, EMoveFlags.seekplayer);
                } else
                    this.StartAI(this.ais.lobbed);
            }
        }
    }

    Dying() {
        if(this.curAction == this.actions.dead.loc) {
            if(!this.pal)
                return;

            if(IsRespawnActive() && this.Count() >= DN3D.respawnActorTime) {
                this.Spawn(DN3D.ENames.TRANSPORTERSTAR);
                this.CStat(EStats.BLOCK | EStats.BLOCK_HITSCAN);
                this.extra = 100;
                this.CheckSeek();
            } else {
                this.extra = 0;
                if(this.HitByWeapon() && this.weaponHit == DN3D.ENames.RADIUSEXPLOSION) {
                    this.Sound(DN3D.ESound.SQUISHED);
                    DN3D.states.StandardJibs();
                    this.KillIt();
                }
                return;
            }
        }

        if(this.ActionCount() >= 5) {
            if(this.FloorDist() <= 8)
                this.Sound(DN3D.ESound.THUD);

            this.PlayAction(this.actions.dead);
            this.CStat(0);
            if(this.pal == 0)
                EndOfGame(52);
        }
    }

    Lobbed() {
        if(this.CanSee()) {
            if(this.ActionCount() >= 2) {
                this.ResetAction();
                this.Sound(DN3D.ESound.BOS1_ATTACK2);
                this.Shoot(DN3D.ENames.MORTER);
            } else if(this.Count() >= 64 && this.IsRandom(16))
                this.CheckSeek();
        } else
            this.CheckSeek();
    }

    ShootEnemy() {
        if(this.Count() >= 72)
            this.CheckSeek();
        else if(this.curAction == this.actions.shoot.loc && this.ActionCount() >= 2) {
            this.Sound(DN3D.ESound.BOS1_ATTACK1);

            this.Shoot(DN3D.ENames.SHOTSPARK1);
            this.Shoot(DN3D.ENames.SHOTSPARK1);
            this.Shoot(DN3D.ENames.SHOTSPARK1);
            this.Shoot(DN3D.ENames.SHOTSPARK1);
            this.Shoot(DN3D.ENames.SHOTSPARK1);
            this.Shoot(DN3D.ENames.SHOTSPARK1);

            this.ResetAction();
        }
    }

    Hit() {
        if(this.IsRandom(2))
            this.Spawn(DN3D.ENames.BLOODPOOL);

        if(this.IsDead()) {
            if(!this.pal)
                this.Sound(DN3D.ESound.DUKE_TALKTOBOSSFALL, true);
            else {
                if(this.IsRandom(64))
                    this.Sound(DN3D.ESound.DUKE_TALKTOBOSSFALL, true);

                if(this.weaponHit == DN3D.ENames.FREEZEBLAST) {
                    this.Sound(DN3D.ESound.SOMETHINGFROZE);
                    this.Pal(1);
                    ActionAndMove(this.actions.frozen, null, 0);
                    this.extra = 0;
                    return;
                }
            } 

            this.Sound(DN3D.ESound.BOS1_DYING);

            this.AddKills(1);
            this.StartAI(this.ais.dying);
        } else {
            if(this.IsRandom(32))
                ActionAndMove(this.actions.flintch, null, 0);

            if(this.pal && this.weaponHit == DN3D.ENames.SHRINKSPARK) {
                this.Sound(DN3D.ESound.ACTOR_SHRINKING);
                this.StartAI(this.ais.palShrink);
                return;
            }

            this.Sound(DN3D.ESound.BOS1_PAIN, false, true);

            this.Debris(DN3D.ENames.SCRAP1, 1);
            this.Guts(DN3D.ENames.JIBS6, 1);
        }
    }
    

    Main() {
        this.Fall();

        if(this.curAction == this.actions.frozen.loc) {
            if(this.Count() >= DN3D.thawTime) {
                this.StartAI(this.ais.seek);
                this.Pal(21);
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
                this.Glass(30);

                if(this.IsRandom(84))
                    this.Spawn(DN3D.ENames.BLOODPOOL);

                this.Sound(DN3D.ESound.GLASS_BREAKING);
                this.KillIt();
            }

            if(IsPlayerState(EPlayerStates.facing) && this.playerDist < DN3D.frozenQuickKickDist)
                this.PlayerKick();

            return;
        }

        if(this.curAction == this.actions.flintch.loc) {
            if(this.ActionCount() >= 3)
                this.StartAI(this.ais.shoot);
        } else {
            switch(this.curAI) {
                case 0:
                    if(this.pal == 0)
                        this.StartAI(this.ais.run);
                    else {
                        this.extra = 1000;
                        this.StartAI(this.ais.shoot);
                    }
                    break;
                case this.ais.seek.loc:
                    this.Seek();
                    break;
                case this.ais.run.loc:
                    this.Run();
                    break;
                case this.ais.shoot.loc:
                    this.ShootEnemy();
                    break;
                case this.ais.lobbed.loc:
                    this.Lobbed();
                    break;
                case this.ais.palShrink.loc:
                    this.PalShrunk();
                    break;
            }
        }

        if(this.curAI == this.ais.dying.loc)
            this.Dying();
        else {
            if(this.HitByWeapon() == true) {
                PrintValue(2);
                this.Hit();
            } else if(IsPlayerState(EPlayerStates.alive)
                && !this.pal
                && this.playerDist < 1280) {
                    players[0].actor.extra -= 1000;
                    PalFrom(63, 0, 0, 63);
            }
        }
    }

    protected Variations: OnVariation<BattleLord> = {
        OnStayPut(this: BattleLord) {
            this.flags |= ESpriteFlags.BADGUYSTAYPUT;
            this.picnum = this.defaultPicnum;
            return {
                picnum: DN3D.ENames.BOSS1STAYPUT,
                extra: this.defaultStrength
            }
        }
    }
}