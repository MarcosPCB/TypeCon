// Pre-declared gamevars from Gv_AddSystemVars() in gamevars.cpp
// These are always valid references without a gamevar declaration
export const BUILTIN_GAMEVARS = new Set<string>([
  // Actor context
  'THISACTOR',
  // Return value
  'RETURN',
  // Player connectivity
  'myconnectindex', 'numplayers', 'screenpeek',
  // Game state
  'COOP', 'FFIRE', 'LEVEL', 'MARKER', 'MONSTERS_OFF', 'MULTIMODE',
  'RESPAWN_INVENTORY', 'RESPAWN_ITEMS', 'RESPAWN_MONSTERS', 'VOLUME',
  'automapping', 'randomseed',
  // Sprite/map counts
  'Numsprites', 'NUMSECTORS', 'NUMWALLS',
  // Timing
  'totalclock', 'framerate',
  // Display
  'xdim', 'ydim', 'yxaspect', 'viewingrange',
  // Weapon
  'WEAPON', 'WORKSLIKE',
  // Sprite fields
  'TEXTURE', 'HITAG', 'LOTAG',
  // Per-player
  'ZRANGE', 'ANGRANGE', 'AUTOAIMANGLE',
  // Camera
  'cameraang', 'cameraq16ang', 'camerax', 'cameray', 'cameraz',
  'camerasect', 'cameradist', 'cameraclock', 'camerahoriz', 'cameraq16horiz',
  // HUD/weapon
  'gun_pos', 'weapon_xoffset', 'weaponcount', 'gs',
  'looking_angSR1', 'looking_arc',
  // Struct-shortcut vars (GAMEVAR_SPECIAL — not user-declarable)
  'sprite', '__sprite__', '__actor__', '__spriteext__',
  'sector', '__sector__',
  'wall', '__wall__',
  'player', '__player__',
  'actorvar', 'playervar',
  'tspr', 'projectile', 'thisprojectile',
  'userdef', 'input', 'tiledata', 'paldata',
]);

// Pre-declared gamearrays from Gv_AddSystemVars() in gamevars.cpp
export const BUILTIN_GAMEARRAYS = new Set<string>([
  'gotpic', 'gotsector', 'show2dsector', 'radiusdmgstatnums',
  'tilesizx', 'tilesizy',
  // TypeCON's own memory array — always declared by the VM header
  'flat',
  // TypeCON's allocation table
  'allocTable',
  // rstack is a built-in engine array
  'rstack',
]);

// Limits from gamevars.h and gamedef.h
export const LIMITS = {
  MAXGAMEVARS:  2048,
  MAXGAMEARRAYS: 512,
  MAXLABELS:    16384,
  MAXVARLABEL:  26,     // name must be < 26 chars (25 usable)
  MAXTILES:     30720,
  MAXQUOTES:    16384,
} as const;
