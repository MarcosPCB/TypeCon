import '../../../include/TCSet100/types';

class Vec3 {
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;

    constructor() {}
}

class Color {
    public r: number = 0;
    public g: number = 0;
    public b: number = 0;
    public a: number = 255;

    constructor() {}
}

class TestObjectMethods extends CEvent {
    constructor() { super('InitComplete'); }

    // debug-test
    public Append(): void {
        // ── Object.assign ─────────────────────────────────────────────────────
        let src = new Vec3();
        src.x = 10;
        src.y = 20;
        src.z = 30;

        let dst = new Vec3();
        dst.x = 1;
        dst.y = 2;
        dst.z = 3;

        Object.assign(dst, src);
        let ax = dst.x; let ay = dst.y; let az = dst.z;
        checkEq("assign.x", 10, ax);
        checkEq("assign.y", 20, ay);
        checkEq("assign.z", 30, az);

        // src must be unchanged
        let sx = src.x; let sy = src.y; let sz = src.z;
        checkEq("assign src.x unchanged", 10, sx);
        checkEq("assign src.y unchanged", 20, sy);
        checkEq("assign src.z unchanged", 30, sz);

        // ── Object.values ─────────────────────────────────────────────────────
        let vc = new Vec3();
        vc.x = 100;
        vc.y = 200;
        vc.z = 300;

        let vals = Object.values(vc);
        let vl = vals.length;
        let v0 = vals[0]; let v1 = vals[1]; let v2 = vals[2];
        checkEq("values len", 3, vl);
        checkEq("values[0]", 100, v0);
        checkEq("values[1]", 200, v1);
        checkEq("values[2]", 300, v2);

        // ── Object.keys ───────────────────────────────────────────────────────
        let kobj = new Vec3();
        let keys = Object.keys(kobj);
        let kl = keys.length;
        checkEq("keys len", 3, kl);

        // Verify key string lengths: "x"=1, "y"=1, "z"=1
        let k0 = keys[0]; let k1 = keys[1]; let k2 = keys[2];
        checkEq("keys[0] len", 1, k0.length);
        checkEq("keys[1] len", 1, k1.length);
        checkEq("keys[2] len", 1, k2.length);

        // Verify key string char codes: 'x'=120, 'y'=121, 'z'=122
        checkEq("keys[0][0]", 120, charCodeAt(k0, 0));
        checkEq("keys[1][0]", 121, charCodeAt(k1, 0));
        checkEq("keys[2][0]", 122, charCodeAt(k2, 0));

        // ── Object.keys with multi-char field names ───────────────────────────
        let cobj = new Color();
        let ckeys = Object.keys(cobj);
        let ckl = ckeys.length;
        checkEq("color keys len", 4, ckl);

        // Key string lengths: "r"=1, "g"=1, "b"=1, "a"=1
        let ck0 = ckeys[0]; let ck1 = ckeys[1]; let ck2 = ckeys[2]; let ck3 = ckeys[3];
        checkEq("color keys[0] len", 1, ck0.length);
        checkEq("color keys[3] len", 1, ck3.length);

        // Verify char codes: 'r'=114, 'g'=103, 'b'=98, 'a'=97
        checkEq("color keys[0][0]", 114, charCodeAt(ck0, 0));
        checkEq("color keys[1][0]", 103, charCodeAt(ck1, 0));
        checkEq("color keys[2][0]", 98, charCodeAt(ck2, 0));
        checkEq("color keys[3][0]", 97, charCodeAt(ck3, 0));

        // ── Object.values with Color (4 fields) ───────────────────────────────
        let cv = new Color();
        cv.r = 255;
        cv.g = 128;
        cv.b = 64;
        cv.a = 32;

        let cvals = Object.values(cv);
        let cv0 = cvals[0]; let cv1 = cvals[1]; let cv2 = cvals[2]; let cv3 = cvals[3];
        checkEq("color values[0]", 255, cv0);
        checkEq("color values[1]", 128, cv1);
        checkEq("color values[2]", 64, cv2);
        checkEq("color values[3]", 32, cv3);
    }
}
