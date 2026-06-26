import '../../types';

function _Math_pow(base: number, exp: number): number {
    let result: number = 1;
    let i: number = 0;
    while (i < exp) {
        result = result * base;
        i = i + 1;
    }
    return result;
}

function _Math_powFP(base: FP16, exp: number): FP16 {
    let result: FP16 = 1.0;
    let i: number = 0;
    while (i < exp) {
        result = result * base;   // mulscale — both FP16
        i = i + 1;
    }
    return result;
}

function _Math_log(x: number): number {
    let bits: number = 0;
    let v: number = x;
    while (v > 1) {
        v = v >> 1;
        bits = bits + 1;
    }
    return bits * 45426;
}

function _Math_logFP(x: number): number {
    let bits: number = 0;
    let v: number = x;
    while (v > 1) {
        v = v >> 1;
        bits = bits + 1;
    }
    return (bits - 16) * 45426;
}

function _Math_log2(x: number): number {
    let bits: number = 0;
    let v: number = x;
    while (v > 1) {
        v = v >> 1;
        bits = bits + 1;
    }
    return bits * 65536;
}

function _Math_log10(x: number): number {
    let bits: number = 0;
    let v: number = x;
    while (v > 1) {
        v = v >> 1;
        bits = bits + 1;
    }
    return bits * 19729;
}

function _Math_exp(x: number): FP16 {
    let result: FP16 = 1.0;
    let i: number = 0;
    while (i < x) {
        result = mulscale(result, 178145, 16); // 178145 = round(e * 65536) in FP16
        i = i + 1;
    }
    return result;
}

function _Math_rotatePoint(x1: number, y1: number, x2: number, y2: number, angle: FP14): vec2 {
    const result: vec2 = { x: 0, y: 0 };

    CONUnsafe(`rotatepoint r0 r1 r2 r3 r4 ra rd`);

    result.x = sysFrame.rb;
    result.y = sysFrame.rd;

    return result;
}

// Dedicated output gamevars for lineintersect / rayintersect
let _lint_x: gameVar = 0 as gameVar;
let _lint_y: gameVar = 0 as gameVar;
let _lint_z: gameVar = 0 as gameVar;
let _lint_ret: gameVar = 0 as gameVar;

function _Math_LineIntersect(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, x1: number, y1: number, x2: number, y2: number): IntersectResult {
    const result: IntersectResult = { hit: 0, x: 0, y: 0, z: 0 };
    CONUnsafe(`lineintersect r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 _lint_x _lint_y _lint_z _lint_ret`);
    result.hit = _lint_ret;
    result.x = _lint_x;
    result.y = _lint_y;
    result.z = _lint_z;
    return result;
}

function _Math_RayIntersect(x: number, y: number, z: number, vx: number, vy: number, vz: number, x1: number, y1: number, x2: number, y2: number): IntersectResult {
    const result: IntersectResult = { hit: 0, x: 0, y: 0, z: 0 };
    CONUnsafe(`rayintersect r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 _lint_x _lint_y _lint_z _lint_ret`);
    result.hit = _lint_ret;
    result.x = _lint_x;
    result.y = _lint_y;
    result.z = _lint_z;
    return result;
}

