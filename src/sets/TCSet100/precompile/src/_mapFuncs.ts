import '../../types';

// Dedicated output gamevars for hitscan (shared, read-before-any-alloc)
let _hitscan_sect: gameVar = 0 as gameVar;
let _hitscan_wall: gameVar = 0 as gameVar;
let _hitscan_spr: gameVar = 0 as gameVar;
let _hitscan_x: gameVar = 0 as gameVar;
let _hitscan_y: gameVar = 0 as gameVar;
let _hitscan_z: gameVar = 0 as gameVar;

// Dedicated output gamevars for neartag
let _ntag_sect: gameVar = 0 as gameVar;
let _ntag_wall: gameVar = 0 as gameVar;
let _ntag_spr: gameVar = 0 as gameVar;
let _ntag_dist: gameVar = 0 as gameVar;

// Dedicated output gamevars for getzrange
let _zr_ceilz: gameVar = 0 as gameVar;
let _zr_ceilhit: gameVar = 0 as gameVar;
let _zr_florz: gameVar = 0 as gameVar;
let _zr_florhit: gameVar = 0 as gameVar;

function _Map_Hitscan(x: number, y: number, z: number, sect: number, vx: number, vy: number, vz: number, clipmask: number): HitscanResult {
    const result: HitscanResult = { sector: 0, wall: 0, sprite: 0, x: 0, y: 0, z: 0 };
    CONUnsafe(`hitscan r0 r1 r2 r3 r4 r5 r6 _hitscan_sect _hitscan_wall _hitscan_spr _hitscan_x _hitscan_y _hitscan_z r7`);
    result.sector = _hitscan_sect;
    result.wall = _hitscan_wall;
    result.sprite = _hitscan_spr;
    result.x = _hitscan_x;
    result.y = _hitscan_y;
    result.z = _hitscan_z;
    return result;
}

function _Map_NearTag(x: number, y: number, z: number, sect: number, ang: number, range: number, tagsearch: number): NearTagResult {
    const result: NearTagResult = { sector: 0, wall: 0, sprite: 0, dist: 0 };
    CONUnsafe(`neartag r0 r1 r2 r3 r4 _ntag_sect _ntag_wall _ntag_spr _ntag_dist r5 r6`);
    result.sector = _ntag_sect;
    result.wall = _ntag_wall;
    result.sprite = _ntag_spr;
    result.dist = _ntag_dist;
    return result;
}

function _Map_GetZRange(x: number, y: number, z: number, sect: number, walldist: number, clipmask: number): ZRangeResult {
    const result: ZRangeResult = { ceilZ: 0, ceilHit: 0, florZ: 0, florHit: 0 };
    CONUnsafe(`getzrange r0 r1 r2 r3 _zr_ceilz _zr_ceilhit _zr_florz _zr_florhit r4 r5`);
    result.ceilZ = _zr_ceilz;
    result.ceilHit = _zr_ceilhit;
    result.florZ = _zr_florz;
    result.florHit = _zr_florhit;
    return result;
}
