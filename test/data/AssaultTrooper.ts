import '../../include/TCSet100/types'

class AssaultTrooper extends CActor {
    constructor() {
        /* ------------------------------------------------------------------ */
        /*  ACTIONS                                                           */
        /* ------------------------------------------------------------------ */
        const TROOPER_ACTIONS: IAction[] = [
            { name: 'ATROOPSTAND',       start:   0, length: 1, viewType: 5, incValue:  1, delay:  1 },
            { name: 'ATROOPGROW',        start:   0, length: 1, viewType: 5, incValue:  1, delay:  1 },
            { name: 'ATROOPSTAYSTAND',   start:  -2, length: 1, viewType: 5, incValue:  1, delay:  1 },
            { name: 'ATROOPWALKING',     start:   0, length: 4, viewType: 5, incValue:  1, delay: 12 },
            { name: 'ATROOPWALKINGBACK', start:  15, length: 4, viewType: 5, incValue: -1, delay: 12 },
            { name: 'ATROOPRUNNING',     start:   0, length: 4, viewType: 5, incValue:  1, delay:  8 },
            { name: 'ATROOPSHOOT',       start:  35, length: 1, viewType: 5, incValue:  1, delay: 30 },
            { name: 'ATROOPJETPACK',     start:  40, length: 1, viewType: 5, incValue:  1, delay:  1 },
            { name: 'ATROOPJETPACKILL',  start:  40, length: 2, viewType: 5, incValue:  1, delay: 50 },
            { name: 'ATROOPFLINTCH',     start:  50, length: 1, viewType: 1, incValue:  1, delay:  6 },
            { name: 'ATROOPDYING',       start:  50, length: 5, viewType: 1, incValue:  1, delay: 16 },
            { name: 'ATROOPDEAD',        start:  54, length: 1, viewType: 5, incValue:  0, delay:  0 },
            { name: 'ATROOPPLAYDEAD',    start:  54, length: 1, viewType: 5, incValue:  0, delay:  0 },
            { name: 'ATROOPSUFFERDEAD',  start:  58, length: 2, viewType: 1, incValue: -4, delay: 24 },
            { name: 'ATROOPSUFFERING',   start:  59, length: 2, viewType: 1, incValue:  1, delay: 21 },
            { name: 'ATROOPDUCK',        start:  64, length: 1, viewType: 5, incValue:  1, delay:  3 },
            { name: 'ATROOPDUCKSHOOT',   start:  64, length: 2, viewType: 5, incValue:  1, delay: 25 },
            { name: 'ATROOPABOUTHIDE',   start:  74, length: 1, viewType: 1, incValue:  1, delay: 25 },
            { name: 'ATROOPHIDE',        start:  79, length: 1, viewType: 1, incValue:  1, delay: 25 },
            { name: 'ATROOPREAPPEAR',    start:  74, length: 1, viewType: 1, incValue:  1, delay: 25 },
            { name: 'ATROOPFROZEN',      start:   0, length: 1, viewType: 5, incValue:  0, delay:  0 },
        ];

        /* ------------------------------------------------------------------ */
        /*  MOVES                                                             */
        /* ------------------------------------------------------------------ */
        const TROOPER_MOVES: IMove[] = [
            { name: 'TROOPWALKVELS',       horizontal_vel:   72, vertical_vel:   0 },
            { name: 'TROOPWALKVELSBACK',   horizontal_vel:  -72, vertical_vel:   0 },
            { name: 'TROOPJETPACKVELS',    horizontal_vel:   64, vertical_vel: -84 },
            { name: 'TROOPJETPACKILLVELS', horizontal_vel:  192, vertical_vel: -38 },
            { name: 'TROOPRUNVELS',        horizontal_vel:  108, vertical_vel:   0 },
            { name: 'TROOPSTOPPED',        horizontal_vel:    0, vertical_vel:   0 },
            { name: 'DONTGETUP',           horizontal_vel:    0, vertical_vel:   0 },
            { name: 'SHRUNKVELS',          horizontal_vel:   32, vertical_vel:   0 },
        ];

        /* ------------------------------------------------------------------ */
        /*  AI CONFIGS                                                        */
        /* ------------------------------------------------------------------ */
        const TROOPER_AIS: IAi[] = [
            {
                name: 'AITROOPSEEKENEMY',
                action: 'ATROOPWALKING',
                move: 'TROOPWALKVELS',
                flags: EMoveFlags.seekplayer,
            },
            {
                name: 'AITROOPSEEKPLAYER',
                action: 'ATROOPWALKING',
                move: 'TROOPWALKVELS',
                flags: EMoveFlags.seekplayer,
            },
            {
                name: 'AITROOPFLEEING',
                action: 'ATROOPWALKING',
                move: 'TROOPWALKVELS',
                flags: EMoveFlags.fleeenemy,
            },
            {
                name: 'AITROOPFLEEINGBACK',
                action: 'ATROOPWALKINGBACK',
                move: 'TROOPWALKVELSBACK',
                flags: EMoveFlags.faceplayer,
            },
            {
                name: 'AITROOPDODGE',
                action: 'ATROOPWALKING',
                move: 'TROOPRUNVELS',
                flags: EMoveFlags.dodgebullet,
            },
            {
                name: 'AITROOPSHOOTING',
                action: 'ATROOPSHOOT',
                move: 'TROOPSTOPPED',
                flags: EMoveFlags.faceplayer,
            },
            {
                name: 'AITROOPDUCKING',
                action: 'ATROOPDUCK',
                move: 'TROOPSTOPPED',
                flags: EMoveFlags.faceplayer,
            },
            {
                name: 'AITROOPJETPACK',
                action: 'ATROOPJETPACK',
                move: 'TROOPJETPACKVELS',
                flags: EMoveFlags.seekplayer,
            },
            {
                name: 'AITROOPSHRUNK',
                action: 'ATROOPWALKING',
                move: 'SHRUNKVELS',
                flags: EMoveFlags.fleeenemy,
            },
            {
                name: 'AITROOPHIDE',
                action: 'ATROOPABOUTHIDE',
                move: 'TROOPSTOPPED',
                flags: EMoveFlags.faceplayer,
            },
            {
                name: 'AITROOPGROW',
                action: 'ATROOPGROW',
                move: 'DONTGETUP',
                flags: EMoveFlags.faceplayerslow,
            },
        ];


        super(1680, true, 30, TROOPER_ACTIONS, undefined, TROOPER_MOVES, TROOPER_AIS);
    }

    Main() {

    }
}