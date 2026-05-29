// Field name sets derived directly from the memberlabel_t arrays in
// eduke32_src/source/duke3d/src/gamestructures.cpp.
// These are the authoritative CON-level accessor names for each struct.

export const SECTOR_FIELDS = new Set<string>([
  'wallptr', 'wallnum',
  'ceilingz', 'ceilingzgoal', 'ceilingzvel',
  'floorz', 'floorzgoal', 'floorzvel',
  'ceilingstat', 'floorstat',
  'ceilingpicnum', 'ceilingslope',
  'ceilingshade', 'ceilingpal', 'ceilingxpanning', 'ceilingypanning',
  'floorpicnum', 'floorslope',
  'floorshade', 'floorpal', 'floorxpanning', 'floorypanning',
  'visibility', 'fogpal',
  'lotag', 'hitag', 'extra',
  'ceilingbunch', 'floorbunch',
  'ulotag', 'uhitag',
]);

export const WALL_FIELDS = new Set<string>([
  'x', 'y', 'point2', 'nextwall', 'nextsector',
  'cstat', 'picnum', 'overpicnum',
  'shade', 'pal',
  'xrepeat', 'yrepeat', 'xpanning', 'ypanning',
  'lotag', 'hitag', 'extra',
  'ulotag', 'uhitag',
  'blend', 'ang',
]);

export const ACTOR_FIELDS = new Set<string>([
  // sprite fields
  'x', 'y', 'z',
  'cstat', 'picnum', 'shade', 'pal', 'clipdist', 'blend',
  'xrepeat', 'yrepeat', 'xoffset', 'yoffset',
  'sectnum', 'statnum', 'ang', 'owner',
  'xvel', 'yvel', 'zvel',
  'lotag', 'hitag', 'extra',
  'ulotag', 'uhitag',
  // actor_t fields
  'htcgg', 'htpicnum', 'htang', 'htextra', 'htowner',
  'htmovflag', 'htumovflag', 'httempang', 'htactorstayput',
  'htfloorzoffset', 'htwaterzoffset', 'htdispicnum', 'httimetosleep',
  'htfloorz', 'htceilingz', 'htlastvx', 'htlastvy',
  'htbposx', 'htbposy', 'htbposz',
  'htg_t', 'htflags',
  // spriteext fields
  'angoff', 'pitch', 'roll',
  'mdxoff', 'mdyoff', 'mdzoff',
  'mdposxoff', 'mdposyoff', 'mdposzoff',
  'mdflags',
  'xpanning', 'ypanning',
  // computed / aliases
  'alpha', 'isvalid',
  'movflags',   // alias for hitag
  'detail',     // deprecated alias for blend
]);

export const TSPRITE_FIELDS = new Set<string>([
  'tsprx', 'tspry', 'tsprz',
  'tsprcstat', 'tsprpicnum', 'tsprshade', 'tsprpal', 'tsprclipdist', 'tsprblend',
  'tsprxrepeat', 'tspryrepeat', 'tsprxoffset', 'tspryoffset',
  'tsprsectnum', 'tsprstatnum', 'tsprang', 'tsprowner',
  'tsprxvel', 'tspryvel', 'tsprzvel',
  'tsprlotag', 'tsprhitag', 'tsprextra',
]);

export const PLAYER_FIELDS = new Set<string>([
  'zoom',
  'loogiex', 'loogiey', 'numloogs', 'loogcnt',
  'posx', 'posy', 'posz',
  'horiz', 'horizoff', 'ohoriz', 'ohorizoff',
  'q16horiz', 'q16horizoff', 'oq16horiz', 'oq16horizoff',
  'invdisptime',
  'bobposx', 'bobposy',
  'oposx', 'oposy', 'oposz',
  'pyoff', 'opyoff',
  'posxv', 'posyv', 'poszv',
  'last_pissed_time',
  'truefz', 'truecz', 'player_par',
  'visibility', 'bobcounter', 'weapon_sway', 'pals_time', 'crack_time', 'aim_mode',
  'ang', 'oang', 'q16ang', 'oq16ang', 'angvel', 'q16angvel',
  'cursectnum', 'look_ang', 'last_extra',
  'subweapon', 'ammo_amount',
  'wackedbyactor', 'frag', 'fraggedself',
  'curr_weapon', 'last_weapon',
  'tipincs', 'wantweaponfire', 'holoduke_amount',
  'newowner', 'hurt_delay', 'hbomb_hold_delay',
  'jumping_counter', 'airleft', 'knee_incs',
  'access_incs', 'fta', 'ftq',
  'access_wallnum', 'access_spritenum',
  'kickback_pic', 'got_access', 'weapon_ang',
  'firstaid_amount', 'somethingonplayer', 'on_crane',
  'i', 'parallax_sectnum', 'over_shoulder_on',
  'random_club_frame', 'fist_incs', 'one_eighty_count',
  'cheat_phase', 'dummyplayersprite', 'extra_extra8',
  'quick_kick', 'heat_amount',
  'actorsqu', 'timebeforeexit', 'customexitsound',
  'weaprecs', 'weapreccnt',
  'interface_toggle', 'rotscrnang', 'dead_flag', 'show_empty_weapon',
  'scuba_amount', 'jetpack_amount', 'steroids_amount', 'shield_amount',
  'holoduke_on', 'pycount', 'weapon_pos', 'frag_ps', 'transporter_hold',
  'clipdist', 'last_full_weapon', 'footprintshade', 'boot_amount', 'scream_voice',
  'gm', 'on_warping_sector', 'footprintcount',
  'hbomb_on', 'jumping_toggle', 'rapid_fire_hold', 'on_ground',
  'name', 'inven_icon', 'buttonpalette',
  'jetpack_on', 'spritebridge', 'scuba_on', 'footprintpal',
  'heat_on', 'holster_weapon', 'falling_counter',
  'gotweapon', 'palette',
  'toggle_key_flag', 'knuckle_incs', 'walking_snd_toggle',
  'palookup', 'hard_landing',
  'max_secret_rooms', 'secret_rooms',
  'pals',
  'max_actors_killed', 'actors_killed',
  'return_to_center', 'runspeed', 'sbs', 'reloading',
  'auto_aim', 'movement_lock', 'sound_pitch', 'weaponswitch',
  'team', 'max_player_health', 'max_shield_amount', 'max_ammo_amount',
  'last_quick_kick', 'autostep', 'autostep_sbw',
  'hudpal', 'index', 'connected', 'frags', 'deaths',
  'last_used_weapon', 'bsubweapon', 'crouch_toggle',
  'gravity', 'floorzoffset', 'spritezoffset', 'minwaterzdist',
  'waterzoffset', 'shrunkzoffset', 'crouchzincrement', 'crouchspeedmodifier',
  'swimspeedmodifier', 'swimzincrement', 'minswimzvel', 'maxswimzvel',
  'jetpackzincrement',
  'olook_ang', 'orotscrnang',
  'floorzrebound', 'floorzcutoff',
]);

export const PROJECTILE_FIELDS = new Set<string>([
  'workslike', 'spawns', 'sxrepeat', 'syrepeat', 'sound', 'isound',
  'vel', 'extra', 'decal', 'trail',
  'txrepeat', 'tyrepeat', 'toffset', 'tnum', 'drop',
  'cstat', 'clipdist', 'shade', 'xrepeat', 'yrepeat', 'pal',
  'extra_rand', 'hitradius', 'velmult', 'offset',
  'bounces', 'bsound', 'range', 'flashcolor', 'userdata',
]);

export const USERDEF_FIELDS = new Set<string>([
  'god', 'warp_on', 'cashman', 'eog', 'showallmap', 'show_help',
  'scrollmode', 'clipping',
  'user_name', 'ridecule', 'savegame', 'pwlockout', 'rtsname;',
  'overhead_on', 'last_overhead', 'showweapons', 'pause_on', 'from_bonus',
  'camerasprite', 'last_camsprite', 'last_level', 'secretlevel',
  'const_visibility', 'uw_framerate', 'camera_time',
  'folfvel', 'folsvel', 'folavel', 'folx', 'foly', 'fola',
  'reccnt', 'entered_name', 'screen_tilting', 'shadows',
  'fta_on', 'executions', 'auto_run', 'coords', 'tickrate',
  'm_coop', 'coop', 'screen_size', 'lockout', 'crosshair', 'playerai',
  'respawn_monsters', 'respawn_items', 'respawn_inventory',
  'recstat', 'monsters_off', 'brightness',
  'm_respawn_items', 'm_respawn_monsters', 'm_respawn_inventory',
  'm_recstat', 'm_monsters_off', 'detail',
  'm_ffire', 'ffire',
  'm_player_skill', 'm_level_number', 'm_volume_number',
  'multimode', 'player_skill', 'level_number', 'volume_number',
  'm_marker', 'marker',
  'mouseflip', 'statusbarscale', 'drawweapon', 'mouseaiming', 'weaponswitch',
  'democams', 'color', 'msgdisptime', 'statusbarmode',
  'm_noexits', 'noexits', 'autovote', 'automsg', 'idplayers', 'team',
  'viewbob', 'weaponsway', 'obituaries', 'levelstats',
  'crosshairscale', 'althud', 'display_bonus_screen', 'show_level_text',
  'weaponscale', 'textscale', 'runkey_mode',
  'm_origin_x', 'm_origin_y', 'playerbest',
  'musictoggle', 'usevoxels', 'usehightile', 'usemodels',
  'gametypeflags', 'm_gametypeflags', 'globalflags', 'globalgameflags',
  'vm_player', 'vm_sprite', 'vm_distance', 'soundtoggle',
  'gametext_tracking', 'mgametext_tracking', 'menutext_tracking',
  'maxspritesonscreen',
  'screenarea_x1', 'screenarea_y1', 'screenarea_x2', 'screenarea_y2',
  'screenfade', 'menubackground',
  'statusbarflags', 'statusbarrange', 'statusbarcustom',
  'hudontop', 'menu_slidebarz', 'menu_slidebarmargin', 'menu_slidecursorz',
  'global_r', 'global_g', 'global_b',
  'default_volume', 'default_skill',
  'menu_shadedeselected', 'menu_shadedisabled',
  'menutext_zoom', 'menutext_xspace', 'menutext_pal',
  'menutext_palselected', 'menutext_paldeselected', 'menutext_paldisabled',
  'menutext_palselected_right', 'menutext_paldeselected_right', 'menutext_paldisabled_right',
  'gametext_zoom', 'gametext_xspace', 'gametext_pal',
  'gametext_palselected', 'gametext_paldeselected', 'gametext_paldisabled',
  'gametext_palselected_right', 'gametext_paldeselected_right', 'gametext_paldisabled_right',
  'minitext_zoom', 'minitext_xspace', 'minitext_tracking', 'minitext_pal',
  'minitext_palselected', 'minitext_paldeselected', 'minitext_paldisabled',
  'minitext_palselected_right', 'minitext_paldeselected_right', 'minitext_paldisabled_right',
  'menutitle_pal', 'slidebar_palselected', 'slidebar_paldisabled',
  'user_map', 'm_user_map', 'music_episode', 'music_level',
  'shadow_pal', 'menu_scrollbartilenum', 'menu_scrollbarz', 'menu_scrollcursorz',
  'quote_yoffset', 'return',
  'userbyteversion', 'autosave', 'draw_y', 'draw_yxaspect', 'fov',
  'newgamecustomopen', 'newgamecustomsubopen', 'gamepadactive',
  'm_newgamecustom', 'm_newgamecustomsub', 'm_newgamecustoml3',
  'kick_mode',
]);

export const INPUT_FIELDS = new Set<string>([
  'avel', 'q16avel', 'horz', 'q16horz', 'fvel', 'svel', 'bits', 'extbits',
]);

export const TILEDATA_FIELDS = new Set<string>([
  'xsize', 'ysize', 'animframes', 'xoffset', 'yoffset', 'animspeed', 'animtype', 'gameflags',
]);

export const PALDATA_FIELDS = new Set<string>([
  'nofloorpal',
]);

// Maps the CON op string (as it appears in geta[ri].xxx) → valid field codes
export const STRUCT_FIELD_MAP: Record<string, Set<string>> = {
  a:          ACTOR_FIELDS,
  p:          PLAYER_FIELDS,
  sector:     SECTOR_FIELDS,
  wall:       WALL_FIELDS,
  projectile: PROJECTILE_FIELDS,
  tspr:       TSPRITE_FIELDS,
  userdef:    USERDEF_FIELDS,
  input:      INPUT_FIELDS,
  tiledata:   TILEDATA_FIELDS,
  paldata:    PALDATA_FIELDS,
};
