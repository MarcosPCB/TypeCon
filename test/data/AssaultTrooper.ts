import '../../include/TCSet100/types'

class AssaultTrooper extends CActor {
    /* ─────────────────────────────────────────
    *  ACTIONS
    * ───────────────────────────────────────── */
    protected TROOPER_ACTIONS: TAction<
        | 'ATROOPSTAND' | 'ATROOPGROW' | 'ATROOPSTAYSTAND'
        | 'ATROOPWALKING' | 'ATROOPWALKINGBACK' | 'ATROOPRUNNING'
        | 'ATROOPSHOOT' | 'ATROOPJETPACK' | 'ATROOPJETPACKILL'
        | 'ATROOPFLINTCH' | 'ATROOPDYING' | 'ATROOPDEAD'
        | 'ATROOPPLAYDEAD' | 'ATROOPSUFFERDEAD' | 'ATROOPSUFFERING'
        | 'ATROOPDUCK' | 'ATROOPDUCKSHOOT' | 'ATROOPABOUTHIDE'
        | 'ATROOPHIDE' | 'ATROOPREAPPEAR' | 'ATROOPFROZEN'
    > = {
        ATROOPSTAND: { start: 0, length: 1, viewType: 5, incValue: 1, delay: 1 },
        ATROOPGROW: { start: 0, length: 1, viewType: 5, incValue: 1, delay: 1 },
        ATROOPSTAYSTAND: { start: -2, length: 1, viewType: 5, incValue: 1, delay: 1 },
        ATROOPWALKING: { start: 0, length: 4, viewType: 5, incValue: 1, delay: 12 },
        ATROOPWALKINGBACK: { start: 15, length: 4, viewType: 5, incValue: -1, delay: 12 },
        ATROOPRUNNING: { start: 0, length: 4, viewType: 5, incValue: 1, delay: 8 },
        ATROOPSHOOT: { start: 35, length: 1, viewType: 5, incValue: 1, delay: 30 },
        ATROOPJETPACK: { start: 40, length: 1, viewType: 5, incValue: 1, delay: 1 },
        ATROOPJETPACKILL: { start: 40, length: 2, viewType: 5, incValue: 1, delay: 50 },
        ATROOPFLINTCH: { start: 50, length: 1, viewType: 1, incValue: 1, delay: 6 },
        ATROOPDYING: { start: 50, length: 5, viewType: 1, incValue: 1, delay: 16 },
        ATROOPDEAD: { start: 54, length: 1, viewType: 5, incValue: 0, delay: 0 },
        ATROOPPLAYDEAD: { start: 54, length: 1, viewType: 5, incValue: 0, delay: 0 },
        ATROOPSUFFERDEAD: { start: 58, length: 2, viewType: 1, incValue: -4, delay: 24 },
        ATROOPSUFFERING: { start: 59, length: 2, viewType: 1, incValue: 1, delay: 21 },
        ATROOPDUCK: { start: 64, length: 1, viewType: 5, incValue: 1, delay: 3 },
        ATROOPDUCKSHOOT: { start: 64, length: 2, viewType: 5, incValue: 1, delay: 25 },
        ATROOPABOUTHIDE: { start: 74, length: 1, viewType: 1, incValue: 1, delay: 25 },
        ATROOPHIDE: { start: 79, length: 1, viewType: 1, incValue: 1, delay: 25 },
        ATROOPREAPPEAR: { start: 74, length: 1, viewType: 1, incValue: 1, delay: 25 },
        ATROOPFROZEN: { start: 0, length: 1, viewType: 5, incValue: 0, delay: 0 },
    };

    /* ─────────────────────────────────────────
    *  MOVES
    * ───────────────────────────────────────── */
    protected readonly TROOPER_MOVES: TMove<
        | 'TROOPWALKVELS' | 'TROOPWALKVELSBACK'
        | 'TROOPJETPACKVELS' | 'TROOPJETPACKILLVELS'
        | 'TROOPRUNVELS' | 'TROOPSTOPPED'
        | 'DONTGETUP' | 'SHRUNKVELS'
    > = {
        TROOPWALKVELS: { horizontal_vel: 72, vertical_vel: 0 },
        TROOPWALKVELSBACK: { horizontal_vel: -72, vertical_vel: 0 },
        TROOPJETPACKVELS: { horizontal_vel: 64, vertical_vel: -84 },
        TROOPJETPACKILLVELS: { horizontal_vel: 192, vertical_vel: -38 },
        TROOPRUNVELS: { horizontal_vel: 108, vertical_vel: 0 },
        TROOPSTOPPED: { horizontal_vel: 0, vertical_vel: 0 },
        DONTGETUP: { horizontal_vel: 0, vertical_vel: 0 },
        SHRUNKVELS: { horizontal_vel: 32, vertical_vel: 0 },
    };

    /* ─────────────────────────────────────────
    *  AI CONFIGS
    * ───────────────────────────────────────── */
    protected readonly TROOPER_AIS: TAi<
        | 'AITROOPSEEKENEMY' | 'AITROOPSEEKPLAYER' | 'AITROOPFLEEING'
        | 'AITROOPFLEEINGBACK' | 'AITROOPDODGE' | 'AITROOPSHOOTING'
        | 'AITROOPDUCKING' | 'AITROOPJETPACK' | 'AITROOPSHRUNK'
        | 'AITROOPHIDE' | 'AITROOPGROW'
    > = {
        AITROOPSEEKENEMY: {
            action: 'ATROOPWALKING',
            move: 'TROOPWALKVELS',
            flags: EMoveFlags.seekplayer,
        },
        AITROOPSEEKPLAYER: {
            action: 'ATROOPWALKING',
            move: 'TROOPWALKVELS',
            flags: EMoveFlags.seekplayer,
        },
        AITROOPFLEEING: {
            action: 'ATROOPWALKING',
            move: 'TROOPWALKVELS',
            flags: EMoveFlags.fleeenemy,
        },
        AITROOPFLEEINGBACK: {
            action: 'ATROOPWALKINGBACK',
            move: 'TROOPWALKVELSBACK',
            flags: EMoveFlags.faceplayer,
        },
        AITROOPDODGE: {
            action: 'ATROOPWALKING',
            move: 'TROOPRUNVELS',
            flags: EMoveFlags.dodgebullet,
        },
        AITROOPSHOOTING: {
            action: 'ATROOPSHOOT',
            move: 'TROOPSTOPPED',
            flags: EMoveFlags.faceplayer,
        },
        AITROOPDUCKING: {
            action: 'ATROOPDUCK',
            move: 'TROOPSTOPPED',
            flags: EMoveFlags.faceplayer,
        },
        AITROOPJETPACK: {
            action: 'ATROOPJETPACK',
            move: 'TROOPJETPACKVELS',
            flags: EMoveFlags.seekplayer,
        },
        AITROOPSHRUNK: {
            action: 'ATROOPWALKING',
            move: 'SHRUNKVELS',
            flags: EMoveFlags.fleeenemy,
        },
        AITROOPHIDE: {
            action: 'ATROOPABOUTHIDE',
            move: 'TROOPSTOPPED',
            flags: EMoveFlags.faceplayer,
        },
        AITROOPGROW: {
            action: 'ATROOPGROW',
            move: 'DONTGETUP',
            flags: EMoveFlags.faceplayerslow,
        },
    };

    constructor() {
        super(1680, true, 30);
    }

    Main() {
        this.PlayAction(this.TROOPER_ACTIONS.ATROOPSTAND);
    }
}