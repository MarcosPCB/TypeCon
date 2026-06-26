import { CON_CONSTANT, CON_NATIVE, CON_NATIVE_GAMEVAR, CON_NATIVE_OBJECT, CON_NATIVE_POINTER, CON_NATIVE_STATE } from "./native"

//@typecon
//@langSet=tscon
//@setVersion=100

namespace nocompile { }

declare global {
    // Fixed-point numeric types — 32-bit integers with an implicit binary scale factor.
    // Use these to get automatic mulscale/divscale codegen for * and / operations.
    /**
     * Constant type. Only literals are accepted
     */
    type FP11 = number & { __brandConstant?: never }; // Q20.11 — 1.0 = 2048, BUILD engine BAM angles (0–2047)
    type FP14 = number & { __brandConstant?: never };  // Q17.14 — 1.0 = 16384, BUILD engine sin/cos values (−16384..16384)
    type FP16 = number & { __brandConstant?: never };  // Q15.16 — 1.0 = 65536
    type FP30 = number & { __brandConstant?: never };  // Q1.30  — 1.0 = 1073741824, useful for unit-range values

    // Fixed-point conversion helpers
    function intToFP11(x: number): FP11;
    function intToFP14(x: number): FP14;
    function intToFP16(x: number): FP16;
    function intToFP30(x: number): FP30;
    function fp11ToInt(x: FP11): number;
    function fp14ToInt(x: FP14): number;
    function fp16ToInt(x: FP16): number;
    function fp30ToInt(x: FP30): number;
    /** Return the raw integer backing an FP11 value (BAM angle bits). */
    function fp11Raw(x: FP11): number;
    /** Return the raw integer backing an FP14 value (sin/cos bits). */
    function fp14Raw(x: FP14): number;
    /** Return the raw 32-bit integer backing an FP16 value without any shifting. Use this when an API expects the 16.16 bit pattern directly (e.g. rotatesprite zoom). */
    function fp16Raw(x: FP16): number;
    /** Return the raw integer backing an FP30 value. */
    function fp30Raw(x: FP30): number;
    /** Convert an FP11 value to a decimal string. */
    function fp11ToString(x: FP11): string;
    /** Convert an FP14 value to a decimal string. */
    function fp14ToString(x: FP14): string;
    /** Convert an FP16 value to a decimal string with 4 fractional digits, e.g. fp16ToString(intToFP16(1) + 32768) → "1.5000". Returns a heap-allocated TypeCON string. */
    function fp16ToString(x: FP16): string;
    /** Convert an FP30 value to a decimal string (approximated via FP16). */
    function fp30ToString(x: FP30): string;
    /** Parse a decimal string like "1.5000" or "-160.0000" into an FP16 integer. Inverse of fp16ToString. */
    function fp16FromString(s: string): FP16;
    /** Return the number of characters in a heap-allocated TypeCON string. */
    function strLen(s: string): number;
    /** Return the char code of character at index i in a heap-allocated TypeCON string (0-based). */
    function charCodeAt(s: string, i: number): number;
    /** Return a heap-allocated TypeCON string containing a single character with the given code. */
    function fromCharCode(i: number): string;
    /** Explicit FP precision cast to FP11 (Q20.11, 1.0 = 2048). Shifts integer→FP or FP→FP. */
    function FP11(x: number): FP11;
    /** Explicit FP precision cast to FP14 (Q17.14, 1.0 = 16384). Shifts integer→FP or FP→FP. */
    function FP14(x: number): FP14;
    /** Explicit FP precision cast to FP16 (Q15.16, 1.0 = 65536). Shifts integer→FP or FP→FP. */
    function FP16(x: number): FP16;
    /** Explicit FP precision cast to FP30 (Q1.30, 1.0 = 1073741824). Shifts integer→FP or FP→FP. */
    function FP30(x: number): FP30;

    /**
     * Declares a native EDuke32 gamevar accessible from the in-game console.
     * Usage: const MY_VAR: gameVar = 0;
     * Emits: gamevar MY_VAR 0 REG_FLAGS
     * The initial value can be overridden at build time with --vars MY_VAR=1.
     */
    type gameVar = number & { _brand: 'gamevar' };

    /** Assert integer equality and print "label: exp=X got=Y [PASS/FAIL]" to the OSD. */
    function checkEq(label: string, expected: number, actual: number): void;
    /** Assert FP16 equality and print "label: exp=X.XXXX got=Y.YYYY [PASS/FAIL]" to the OSD. */
    function checkFpEq(label: string, expected: FP16, actual: FP16): void;

    // Raw CON fixed-point math (manual use)
    function mulscale(a: number, b: number, shift: number): number;
    function divscale(a: number, b: number, shift: number): number;
    function scalevar(a: number, b: number, divisor: number): number;

    /**
     * Math — animation and numeric utilities backed by CON instructions.
     *
     * All methods are FP-aware: the compiler detects the fixed-point precision
     * of each argument at compile time and emits the appropriate instruction
     * (e.g. `mulscale` instead of `mul` for FP×FP).
     *
     * **FP16 convention**: 1.0 = 65536, range roughly ±32767.
     * **BAM convention**: full circle = 2048 units (0–2047).
     */
    interface Math {
        /**
         * Strip the fractional part and return the largest integer ≤ x.
         * FP precision is auto-detected from the call site; pass a plain
         * integer to get a plain-integer result.
         * @param x Value to floor.
         * @returns Floored integer.
         */
        floor(x: number): number;
        /**
         * Return the smallest integer ≥ x.
         * @param x Value to ceil.
         * @returns Ceiled integer.
         */
        ceil(x: number): number;
        /**
         * Round x to the nearest integer (half rounds up).
         * @param x Value to round.
         * @returns Rounded integer.
         */
        round(x: number): number;
        /**
         * Truncate toward zero (same as floor for positive values).
         * @param x Value to truncate.
         * @returns Truncated integer.
         */
        trunc(x: number): number;
        /**
         * Absolute value. Preserves the FP precision of the input.
         * @param x Input value (integer or FP).
         * @returns |x| in the same precision as x.
         */
        abs(x: number): number;
        /**
         * Integer square root. For FP input the result keeps the same
         * fractional bit width (result has n/2 fractional bits relative to
         * the raw value — use with care for non-power-of-2 precisions).
         * @param x Radicand (integer or FP).
         * @returns floor(√x).
         */
        sqrt(x: number): number;
        /**
         * Return the smaller of two values. Preserves FP precision.
         * @param a First value.
         * @param b Second value.
         * @returns min(a, b).
         */
        min(a: number, b: number): number;
        /**
         * Return the larger of two values. Preserves FP precision.
         * @param a First value.
         * @param b Second value.
         * @returns max(a, b).
         */
        max(a: number, b: number): number;
        /**
         * Clamp x to the closed interval [min, max]. Preserves FP precision.
         * @param x Value to clamp.
         * @param min Lower bound.
         * @param max Upper bound.
         * @returns x clamped to [min, max].
         */
        clamp(x: number, min: number, max: number): number;
        /**
         * Sine from a BAM angle using the engine lookup table.
         * Pass an FP11 BAM angle (1.0 = 2048 = full circle) or a plain BAM integer (0–2047).
         * @param angle Angle in FP11 BAM units or plain BAM integer.
         * @returns sin(angle) in FP14 (1.0 = 16384).
         */
        sin(angle: FP14): FP14;
        /**
         * Cosine from a BAM angle using the engine lookup table.
         * Pass an FP11 BAM angle (1.0 = 2048 = full circle) or a plain BAM integer (0–2047).
         * @param angle Angle in FP11 BAM units or plain BAM integer.
         * @returns cos(angle) in FP14 (1.0 = 16384).
         */
        cos(angle: FP14): FP14;
        /**
         * Tangent: `sin(bam) / cos(bam)` via precompile defstate.
         * Pass an FP11 BAM angle or a plain BAM integer; undefined near ±90°/270°.
         * @param angle Angle in FP11 BAM units or plain BAM integer.
         * @returns tan(angle) in FP14 (1.0 = 16384).
         */
        tan(angle: FP14): FP14;
        /**
         * Arc-tangent: returns the BAM angle whose tangent is `dy/dx`.
         * Wraps CON `getangle`.
         * @param dy Vertical component.
         * @param dx Horizontal component.
         * @returns Angle in BAM units (0–2047).
         */
        atan2(dy: number, dx: number): number;
        /**
         * Exponentiation via repeated multiplication loop.
         * - Integer base/exp → integer result.
         * - FP16 base → uses mulscale per iteration, result in FP16.
         * `exp ≤ 0` returns 1 (or 1.0 for FP).
         * @param base Base value (integer or FP16).
         * @param exp Exponent (non-negative integer).
         * @returns base^exp.
         */
        pow(base: number, exp: number): number;
        /**
         * Natural logarithm approximation: `floor(log₂(x)) × ln(2)`.
         * - Integer x → result in FP16 (ln(2) ≈ 45426 raw).
         * - FP16 x → subtracts 16 bias bits before scaling.
         * Accurate to the nearest power of two; x must be > 0.
         * @param x Input (integer or raw FP16 integer).
         * @returns Approximate ln(x) in FP16.
         */
        log(x: number): FP16;
        /**
         * Base-2 logarithm approximation: `floor(log₂(x))` scaled to FP16.
         * Each integer bit = 65536 in the result. x must be > 0.
         * @param x Input (integer).
         * @returns Approximate log₂(x) in FP16.
         */
        log2(x: number): FP16;
        /**
         * Base-10 logarithm approximation: `floor(log₂(x)) × log₁₀(2)`.
         * (log₁₀(2) ≈ 19729 raw). x must be > 0.
         * @param x Input (integer).
         * @returns Approximate log₁₀(x) in FP16.
         */
        log10(x: number): FP16;
        /**
         * Natural exponential: `e^x` for non-negative integer `x`.
         * Computed by repeated FP16 multiplication by e (178145 ≈ 2.71828 × 65536).
         * Exact for small non-negative integers; not defined for negative or fractional x.
         * @param x Non-negative integer exponent.
         * @returns e^x in FP16.
         */
        exp(x: number): FP16;
        /**
         * Rounded integer division: `round(a / b)`.
         * @param a Dividend.
         * @param b Divisor (must be non-zero).
         * @returns Nearest integer quotient.
         */
        divr(a: number, b: number): number;
        /**
         * Pseudo-random integer in [0, 32767]. Wraps CON `displayrand`.
         * @returns Random integer.
         */
        random(): number;
        /**
         * Pseudo-random integer in [0, max-1]. Wraps CON `displayrandvarvar`.
         * @param max Upper bound (exclusive).
         * @returns Random integer in [0, max-1].
         */
        randomInt(max: number): number;
        /**
         * Convert degrees to BAM angle units (0–2047 = full circle).
         * Accepts integer or FP16 degrees.
         * @param degrees Angle in degrees.
         * @returns Angle in BAM units.
         */
        toBAM(degrees: number): number;
        /**
         * Convert a BAM angle to integer degrees.
         * @param bam Angle in BAM units (0–2047).
         * @returns Angle in degrees.
         */
        toDeg(bam: number): number;
        /** Integer degrees → FP16 radians. */
        toRad(degrees: number): FP16;
        /** FP16 radians → integer degrees. */
        fromRad(radians: FP16): number;
        /** 64-bit-safe Euclidean distance: √(x²+y²). */
        hypotenuse(x: number, y: number): number;
        /** BAM angle (0–2047) from Δx/Δy components. */
        getAngle(dx: number, dy: number): FP11;
        /** X & Y components after rotating point (px,py) around centre (cx,cy) by angle (BAM). */
        rotatePoint(cx: number, cy: number, px: number, py: number, angle: number): vec2;
        /** Shortest angular increment (signed, in BAM units) needed to move from currentAngle to targetAngle. */
        getIncAngle(currentAngle: number, targetAngle: number): number;
        /** Line-segment intersection: returns the intersection point of ray (ox,oy,oz)+(dx,dy,dz) with wall (x1,y1)-(x2,y2). */
        LineIntersect(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, x1: number, y1: number, x2: number, y2: number): IntersectResult;
        /** Ray intersection: returns the intersection point of ray from (x,y,z) in direction (vx,vy,vz) with wall (x1,y1)-(x2,y2). */
        RayIntersect(x: number, y: number, z: number, vx: number, vy: number, vz: number, x1: number, y1: number, x2: number, y2: number): IntersectResult;
    }

    //Type for native functions

    /**
     * Bit-flags accepted by the Build-engine `rotatesprite*` family of functions.
     * Combine multiple flags with the bitwise OR (`|`) operator.
     * @enum {number}
     * @property {number} TRANS1              Translucency level 1 (≈ 66 % opacity).
     * @property {number} AUTO                Enable 320 × 200 coordinate scaling (recommended for portability).
     * @property {number} YFLIP               Flip the sprite vertically; combine with angle = 1024 for X-flip.
     * @property {number} NOCLIP              Make sprite immune to screen-size changes (e.g. status bar).
     * @property {number} TOPLEFT             Treat the sprite’s top-left as its origin; ignore tile offsets.
     * @property {number} TRANS2              Translucency level 2 (≈ 33 % opacity). Requires `TRANS1`.
     * @property {number} NOMASK              Disable masking (and translucency).
     * @property {number} PERM                **Deprecated** “permanent” tile flag.
     * @property {number} ALIGN_L             Align sprite to the left edge on widescreen displays.
     * @property {number} ALIGN_R             Align sprite to the right edge on widescreen displays.
     * @property {number} STRETCH             Stretch sprite to full resolution (pre-widescreen behaviour).
     * @property {number} ROTATESPRITE_FULL16 Interpret coordinates as 16-bit-shifted “full-precision” values.
     * @property {number} LERP                Interpolate position between calls (per `guniqhudid`).
     * @property {number} FORCELERP           Force interpolation even when the tile number changes.
     */
    export enum EOrientationFlags {
        /** Translucency level 1 (≈ 66 % opacity). */
        TRANS1 = 1,

        /** Enable 320 × 200 coordinate scaling (recommended for portability). */
        AUTO = 2,

        /** Flip vertically; with angle = 1024 this appears as an X-flip. */
        YFLIP = 4,

        /** Ignore screen-size changes (`+`/`−`)—useful for HUD elements. */
        NOCLIP = 8,

        /** Use the sprite’s top-left corner as its origin; ignore tile offsets. */
        TOPLEFT = 16,

        /** Translucency level 2 (≈ 33 % opacity). Requires `TRANS1`. */
        TRANS2 = 32,

        /** Disable masking and translucency entirely. */
        NOMASK = 64,

        /** @deprecated “Permanent” tile flag (no longer used). */
        PERM = 128,

        /** Left-align on widescreen displays. */
        ALIGN_L = 256,

        /** Right-align on widescreen displays. */
        ALIGN_R = 512,

        /** Stretch to full screen resolution, distorting aspect ratio. */
        STRETCH = 1024,

        /** Interpret coordinates as 16-bit-shifted full-precision values (`rotatesprite16`). */
        ROTATESPRITE_FULL16 = 2048,

        /** Interpolate coordinates between successive calls (per `guniqhudid`). */
        LERP = 4096,

        /** Force interpolation even when the tile number changes. */
        FORCELERP = 8192,
    }


    /**
     * Bit‑flags that control how EDuke32 renders on‑screen strings.
     * Combine multiple flags with the bitwise OR (`|`) operator to build a render style.
     * @enum {number}
     * @property {number} XRIGHT              Right‑align text on the *x* axis.
     * @property {number} XCENTER             Center‑align text on the *x* axis.
     * @property {number} YBOTTOM             Bottom‑align text on the *y* axis.
     * @property {number} YCENTER             Center‑align text on the *y* axis.
     * @property {number} INTERNALSPACE       Engine chooses `<xspace>`; your value is added.
     * @property {number} TILESPACE           `<xspace>` derived from the width of the tile after `'~'`.
     * @property {number} INTERNALLINE        Engine chooses `<yline>`; your value is added.
     * @property {number} TILELINE            `<yline>` derived from the height of the tile after `'~'`.
     * @property {number} XOFFSETZERO         Treat `<xbetween>` as a constant glyph width.
     * @property {number} XJUSTIFY            Justify text horizontally (compatible with `XRIGHT` and `XCENTER`).
     * @property {number} YOFFSETZERO         Treat `<ybetween>` as a constant line height.
     * @property {number} YJUSTIFY            Justify text vertically (compatible with `YBOTTOM` and `YCENTER`).
     * @property {number} RESERVED_4096       *Reserved – do not use.*
     * @property {number} UPPERCASE           Force all letters to uppercase.
     * @property {number} INVERTCASE          Swap the case of each letter (combine with `UPPERCASE` for lowercase).
     * @property {number} IGNOREESCAPE        Ignore palette escape sequences (`#`, `##`).
     * @property {number} LITERALESCAPE       Render palette escape sequences literally.
     * @property {number} RESERVED_131072     *Reserved – do not use.*
     * @property {number} CONSTWIDTHNUMS      Render numerals with constant width.
     * @property {number} DIGITALNUMBER       Tile order starts at `'0'`; for digital number tiles.
     * @property {number} BIGALPHANUM         Use the red main‑menu font tile order.
     * @property {number} GRAYFONT            Use the gray‑font tile order.
     * @property {number} NOLOCALE            Skip localization translation.
     * @property {number} VARHEIGHT           Shift by half a tile when `RS_TOPLEFT` is not set.
     * @property {number} CENTERCONSTWIDTH    Center glyphs and respect `<xbetween>` in constant‑width mode.
     */
    export enum ETextFlags {
        /** Right‑align text on the *x* axis. */
        XRIGHT = 1,

        /** Center‑align text on the *x* axis. */
        XCENTER = 2,

        /** Bottom‑align text on the *y* axis. */
        YBOTTOM = 4,

        /** Center‑align text on the *y* axis. */
        YCENTER = 8,

        /** Engine chooses `<xspace>`; your value is added. */
        INTERNALSPACE = 16,

        /** `<xspace>` derived from the width of the tile after `'~'`. */
        TILESPACE = 32,

        /** Engine chooses `<yline>`; your value is added. */
        INTERNALLINE = 64,

        /** `<yline>` derived from the height of the tile after `'~'`. */
        TILELINE = 128,

        /** Treat `<xbetween>` as a constant glyph width. */
        XOFFSETZERO = 256,

        /** Justify text horizontally (compatible with `XRIGHT` and `XCENTER`). */
        XJUSTIFY = 512,

        /** Treat `<ybetween>` as a constant line height. */
        YOFFSETZERO = 1024,

        /** Justify text vertically (compatible with `YBOTTOM` and `YCENTER`). */
        YJUSTIFY = 2048,

        /** *Reserved – do not use.* */
        RESERVED_4096 = 4096,

        /** Force all letters to uppercase. */
        UPPERCASE = 8192,

        /** Swap the case of each letter (combine with `UPPERCASE` for lowercase). */
        INVERTCASE = 16384,

        /** Ignore palette escape sequences (`#`, `##`). */
        IGNOREESCAPE = 32768,

        /** Render palette escape sequences literally. */
        LITERALESCAPE = 65536,

        /** *Reserved – do not use.* */
        RESERVED_131072 = 131072,

        /** Render numerals with constant width. */
        CONSTWIDTHNUMS = 262144,

        /** Tile order starts at `'0'`; for digital number tiles. */
        DIGITALNUMBER = 524288,

        /** Use the red main‑menu font tile order. */
        BIGALPHANUM = 1048576,

        /** Use the gray‑font tile order. */
        GRAYFONT = 2097152,

        /** Skip localization translation. */
        NOLOCALE = 4194304,

        /** Shift text by half a tile when `RS_TOPLEFT` is not set. */
        VARHEIGHT = 8388608,

        /** Center glyphs and respect `<xbetween>` in constant‑width mode. */
        CENTERCONSTWIDTH = 16777216,
    }

    /**
     * **ESpriteFlags** – per-sprite runtime flags (the “SFLAG_” bits from EDuke 32).
     *
     * @property {number} SHADOW              - Generate a shadow (`spriteshadow`).
     * @property {number} NVG                 - Switch to palette 6 when night-vision goggles are active (`spritenvg`).
     * @property {number} NOSHADE             - Ignore sector shade (`spritenoshade`).
     * @property {number} PROJECTILE          - Was created with `defineprojectile`.
     * @property {number} DECAL               - Prevents teleporting; not entered into the decal-deletion queue.
     * @property {number} BADGUY              - Marks the sprite as an enemy (`useractor`).
     * @property {number} NOPAL               - Immune to floor palette (`spritenopal`).
     * @property {number} NOEVENTS            - Excluded from `EVENT_GAME` and `EVENT_PREGAME`.
     * @property {number} NOLIGHT             - Suppress hard-coded Polymer lights.
     * @property {number} USEACTIVATOR        - Reserved flag used by `useractor` (`activate`).
     * @property {number} NULL                - “Null sprite” placeholder in multiplayer (internal).
     * @property {number} NOCLIP              - Calls `clipmove()` with a 0 clipmask (no sprite collisions) – useful for particles.
     * @property {number} NOFLOORSHADOW       - Don’t draw a floor shadow.
     * @property {number} SMOOTHMOVE          - Enable client-side interpolation (smooth movement).
     * @property {number} NOTELEPORT          - Prevent teleportation.
     * @property {number} BADGUYSTAYPUT       - Enemy will not leave its original sector.
     * @property {number} CACHE               - Engine-side cache hint.
     * @property {number} ROTFIXED            - Rotation-fixed around a pivot to avoid round-off drift.
     * @property {number} HARDCODED_BADGUY    - Hard-coded enemy marker (internal).
     * @property {number} DIDNOSE7WATER       - Temporary internal flag.
     * @property {number} NODAMAGEPUSH        - Actor isn’t pushed back by damage.
     * @property {number} NOWATERDIP          - Actor won’t dip into water sectors (lotag 1).
     * @property {number} HURTSPAWNBLOOD      - Spawn blood when hurt (as hard-coded enemies do).
     * @property {number} GREENSLIMEFOOD      - Can be eaten by **GREENSLIME** (Protozoid Slimer).
     * @property {number} REALCLIPDIST        - Always use its explicit `clipdist`.
     * @property {number} WAKEUPBADGUYS       - Wakes up nearby enemies when activated.
     * @property {number} DAMAGEEVENT         - Fires `EVENT_(POST)DAMAGESPRITE` when damaged.
     * @property {number} NOWATERSECTOR       - Cannot move into water sectors.
     * @property {number} QUEUEDFORDELETE     - Marked for deletion by the engine.
     */
    export enum ESpriteFlags {
        /** Generate a shadow (`spriteshadow`). */
        SHADOW = 1,    // 0x00000001

        /** Switch to palette 6 when night-vision goggles are active (`spritenvg`). */
        NVG = 2,    // 0x00000002

        /** Ignore sector shade (`spritenoshade`). */
        NOSHADE = 4,    // 0x00000004

        /** Defined with `defineprojectile`. */
        PROJECTILE = 8,    // 0x00000008

        /** Prevent teleporting; not entered into the decal-deletion queue. */
        DECAL = 16,    // 0x00000010

        /** Marks the sprite as an enemy (`useractor`). */
        BADGUY = 32,    // 0x00000020

        /** Immune to floor palette (`spritenopal`). */
        NOPAL = 64,    // 0x00000040

        /** Excluded from `EVENT_GAME` and `EVENT_PREGAME`. */
        NOEVENTS = 128,    // 0x00000080

        /** Suppress hard-coded Polymer-based lights. */
        NOLIGHT = 256,    // 0x00000100

        /** Reserved flag used by activator logic. */
        USEACTIVATOR = 512,    // 0x00000200

        /** “Null sprite” placeholder in multiplayer (internal). */
        NULL = 1024,    // 0x00000400

        /** Run `clipmove()` with 0 clipmask (no sprite collisions). */
        NOCLIP = 2048,    // 0x00000800

        /** Don’t draw a floor shadow. */
        NOFLOORSHADOW = 4096,    // 0x00001000

        /** Enable client-side interpolation (smooth movement). */
        SMOOTHMOVE = 8192,    // 0x00002000

        /** Prevent teleportation. */
        NOTELEPORT = 16384,    // 0x00004000

        /** Enemy will not leave its original sector. */
        BADGUYSTAYPUT = 32768,    // 0x00008000

        /** Engine-side cache hint. */
        CACHE = 65536,    // 0x00010000

        /** Rotation-fixed to avoid drift. */
        ROTFIXED = 131072,    // 0x00020000

        /** Hard-coded enemy marker (internal). */
        HARDCODED_BADGUY = 262144,    // 0x00040000

        /** Temporary internal flag. */
        DIDNOSE7WATER = 524288,    // 0x00080000

        /** Actor isn’t pushed back by damage. */
        NODAMAGEPUSH = 1048576,    // 0x00100000

        /** Actor won’t dip into water sectors. */
        NOWATERDIP = 2097152,    // 0x00200000

        /** Spawn blood when hurt (hard-coded enemies style). */
        HURTSPAWNBLOOD = 4194304,    // 0x00400000

        /** Can be eaten by the **GREENSLIME** actor. */
        GREENSLIMEFOOD = 8388608,    // 0x00800000

        /** Always use explicit `clipdist`. */
        REALCLIPDIST = 16777216,    // 0x01000000

        /** Wake up nearby enemies on activation. */
        WAKEUPBADGUYS = 33554432,    // 0x02000000

        /** Fire `EVENT_(POST)DAMAGESPRITE` when damaged. */
        DAMAGEEVENT = 67108864,    // 0x04000000

        /** Prevent movement into water sectors. */
        NOWATERSECTOR = 134217728,    // 0x08000000

        /** Marked for deletion by the engine. */
        QUEUEDFORDELETE = 268435456,    // 0x10000000
    }


    /**
     * Interface for declaring fonts used in the game
     * @interface IFont
     * @property {number} tile - The starting tile of the font
     * @property {number} xSpace - The width of the whitespace character
     * @property {number} yLine - the height of an empty line
     * @property {number} xBetween - The x distance between characters
     * @property {number} yBetween - The y distance between lines
     * @property {vec2} offset - The xy offset
     * @property {vec2} maxSizeChar - The maximum width/height of the alphabet characters' (used for line ending calculations)
     * @property {ETextFlags} flags - The font's flags
     */
    export interface IFont {
        tile: number,
        xSpace: number,
        yLine: number,
        xBetween: number,
        yBetween: number,
        offset: vec2,
        maxSizeChar: vec2,
        flags: ETextFlags
    }

    /**
     * Represents the valid player states.
     *
     * This enum is used to determine the current state of the player.
     * Only one state should be set at a time.
     *
     * @enum {number}
     * @readonly
     * @property {number} standing - The player is standing.
     * @property {number} walking - The player is walking.
     * @property {number} running - The player is running.
     * @property {number} ducking - The player is ducking.
     * @property {number} falling - The player is falling.
     * @property {number} jumping - The player is jumping.
     * @property {number} higher - The player is in a higher state (e.g., during a jump).
     * @property {number} walkingback - The player is walking backwards.
     * @property {number} runningback - The player is running backwards.
     * @property {number} kicking - The player is kicking.
     * @property {number} shrunk - The player is shrunk.
     * @property {number} jetpack - The player is using a jetpack.
     * @property {number} onsteroids - The player is on steroids.
     * @property {number} onground - The player is on the ground.
     * @property {number} alive - The player is alive.
     * @property {number} dead - The player is dead.
     * @property {number} facing - The player is facing (direction indicated).
     */
    export enum EPlayerStates {
        standing = 1,
        walking = 2,
        running = 4,
        ducking = 8,
        falling = 16,
        jumping = 32,
        higher = 64,
        walkingback = 128,
        runningback = 256,
        kicking = 512,
        shrunk = 1024,
        jetpack = 2048,
        onsteroids = 4096,
        onground = 8192,
        alive = 16384,
        dead = 32768,
        facing = 65536,
    }

    /**
     * SpriteCStat flags control how a sprite is rendered and interacts in the world.
     *
     * @property {number} BLOCK               - Make sprite blockable
     * @property {number} TRANSLUCENT         - Make sprite transparent (first level)
     * @property {number} XFLIP               - Flip sprite around X-axis
     * @property {number} YFLIP               - Flip sprite around Y-axis
     * @property {number} WALL                - Draw sprite as vertically flat (wall-aligned)
     * @property {number} FLOOR               - Draw sprite as horizontally flat (floor-aligned)
     * @property {number} ONE_SIDE            - Make sprite one-sided
     * @property {number} YCENTER             - Half-submerged (Y-centered)
     * @property {number} BLOCK_HITSCAN       - Make sprite hittable by hitscan weapons
     * @property {number} TRANS_FLIP          - Second transparency level (combine with TRANSLUCENT)
     * @property {number} DRAW_PRIORITY       - Draw in front of other sprites (high priority)
     * @property {number} NOSHADE             - Ignore sector shading
     * @property {number} NO_POLYMER_SHADOW   - Do not cast a Polymer shadow
     * @property {number} INVISIBLE_SHADOW    - Invisible but still casts Polymer shadow
     * @property {number} INVISIBLE           - Completely invisible (skip rendering & events)
     */
    export enum EStats {
        /** Make sprite blockable */
        BLOCK = 1,

        /** Make sprite transparent (first level) */
        TRANSLUCENT = 2,

        /** Flip sprite around X-axis */
        XFLIP = 4,

        /** Flip sprite around Y-axis */
        YFLIP = 8,

        /** Draw sprite as vertically flat (wall-aligned) */
        WALL = 16,

        /** Draw sprite as horizontally flat (floor-aligned) */
        FLOOR = 32,

        /** Make sprite one-sided */
        ONE_SIDE = 64,

        /** Half-submerged (Y-centered) */
        YCENTER = 128,

        /** Make sprite hittable by hitscan weapons */
        BLOCK_HITSCAN = 256,

        /** Second transparency level (combine with TRANSLUCENT) */
        TRANS_FLIP = 512,

        /** Draw in front of other sprites (high priority) */
        DRAW_PRIORITY = 1024,

        /** Ignore sector shading */
        NOSHADE = 2048,

        /** Do not cast a Polymer shadow */
        NO_POLYMER_SHADOW = 8192,

        /** Invisible but still casts Polymer shadow */
        INVISIBLE_SHADOW = 16384,

        /** Completely invisible (skip rendering & events) */
        INVISIBLE = 32768,
    }

    /**
     * One second in game ticks
     */
    const GOneSec: CON_CONSTANT<30>;
    /**
     * One second during display event ticks
     */
    const EOneSec: CON_CONSTANT<120>;

    /**
     * 2D vector type
     * @type vec2
     * @property {number} x - X position
     * @property {number} y - Y position
     */
    export type vec2 = {
        x: number,
        y: number
    }

    /**
     * 3D vector type
     * @type vec3
     * @property {number} x - X position
     * @property {number} y - Y position
     * @property {number} z - Z position
     */
    export type vec3 = {
        x: number,
        y: number,
        z: number,
    }

    /**
     * 2D Positioning type with angle and scaling
     * @type pos2
     * @property {vec2} xy - 2D vector for positioning
     * @property {number} scale - Scaling factor (for screen drawing 65536 is the regular size)
     * @property {number} ang - Angle (0 to 2048)
     */
    export type pos2 = {
        xy: vec2,
        scale: number,
        ang: number
    }

    /**
     * 3D Positioning type with angle and scaling
     * @type pos3
     * @property {vec3} xyz - 3D vector for positioning
     * @property {number} ang - Angle (0 to 2048)
     */
    export type pos3 = {
        xyz: vec3,
        ang: number
    }

    /**
     * Style type used for screen drawing
     * @type TStyle
     * @property {number} shade - Shading value
     * @property {number} pal - Palette swap value
     * @property {EOrientationFlags} orientation - Drawing flags
     */
    export type TStyle = {
        shade: number,
        pal: number,
        orientation: EOrientationFlags
    }

    /**
     * Tagging system used inside Build Engine
     * @interface tag
     * @property {number} lotag - Lower tag
     * @property {number} hitag - Higher tag
     */
    export interface tag {
        lotag: CON_NATIVE<number>;
        hitag: CON_NATIVE<number>;
    }

    /**
     * Interface representing the TypeCON system framework
     * 
     * @property {number} ra - Accumulator register. Used for all kinds of operations. All results are stored in it.
     * @property {number} rb - Base register. Used for return values and sometimes as a helper in some operations.
     * @property {number} rc - Counter register. Used for loops.
     * @property {number} rd - Data registers. Used in if/binary expressions to hold the right side of the operation.
     * @property {number} rf - Flags register.
     * @property {number} ri - Index register. Holds the current index of the stack/heap memory during operations.
     * @property {number} rsi - Source Index register. In operations envolving 2 memory pointers, it usually holds the "source".
     * @property {number} rbp - Base pointer register. Holds the base of the current stack.
     * @property {number} rsp - Stack pointer register. Holds the current stack value.
     * @property {number} rssp - String Stack pointer register. Holds the current string stack value.
     * @property {number} rsbp - String Base pointer register. Hold the base of the current string stack.
     * @property {(number): [] | string} GetReference - Function to get the reference from a register.
     * @property {(any[], boolean): void} BufferToIndex - Returns the reference from the buffer to ri register
     * @property {(any[], boolean): void} BufferToSourceIndex - Returns the reference from the buffer to rsi register
     * 
     * @interface ISys
     */
    export interface ISys {
        r0: CON_NATIVE_GAMEVAR<'r0', number>;
        r1: CON_NATIVE_GAMEVAR<'r1', number>;
        r2: CON_NATIVE_GAMEVAR<'r2', number>;
        r3: CON_NATIVE_GAMEVAR<'r3', number>;
        r4: CON_NATIVE_GAMEVAR<'r4', number>;
        r5: CON_NATIVE_GAMEVAR<'r5', number>;
        r6: CON_NATIVE_GAMEVAR<'r6', number>;
        /**
         * Accumulator register. Used for all kinds of operations. All results are stored in it.
         */
        ra: CON_NATIVE_GAMEVAR<'ra', number>;
        /**
         * Base register. Used for return values and sometimes as a helper in some operations.
         */
        rb: CON_NATIVE_GAMEVAR<'rb', number>;
        /**
         * Counter register. Used for loops.
         */
        rc: CON_NATIVE_GAMEVAR<'rc', number>;
        /**
         * Data registers. Used in if/binary expressions to hold the right side of the operation.
         */
        rd: CON_NATIVE_GAMEVAR<'rd', number>;
        /**
         * Flags register.
         */
        rf: CON_NATIVE_GAMEVAR<'rf', number>;
        /**
         * Index register. Holds the current index of the stack/heap memory during operations.
         */
        ri: CON_NATIVE_GAMEVAR<'ri', number>;
        /**
         * Source Index register. In operations envolving 2 memory pointers, it usually holds the "source".
         */
        rsi: CON_NATIVE_GAMEVAR<'rsi', number>;
        /**
         * Base pointer register. Holds the base of the current stack.
         */
        rbp: CON_NATIVE_GAMEVAR<'rbp', number>;
        /**
         * Stack pointer register. Holds the current stack value.
         */
        rsp: CON_NATIVE_GAMEVAR<'rsp', number>;
        /**
         * String Stack pointer register. Holds the current string stack value.
         */
        rssp: CON_NATIVE_GAMEVAR<'rssp', number>;
        /**
         * String Base pointer register. Hold the base of the current string stack.
         */
        rbsp: CON_NATIVE_GAMEVAR<'rbsp', number>;
        /** Data-segment register — points to the start of the heap (= stackSize + globalStaticSize). */
        rds: CON_NATIVE_GAMEVAR<'rds', number>;
        /** Total heap size in words (stackSize + heapNumPages * heapPageSize). */
        heapsize: CON_NATIVE_GAMEVAR<'heapsize', number>;
        /**
         * Returns a reference from the register's value
         * @param register - The register to get the reference
         */
        GetReference(register: number): [] | string;
        /**
         * Returns the reference from the buffer to ri register
         * @param buffer - The buffer reference
         * @param array - If true, it adds 1 to the ri (first slot is the length)
         */
        BufferToIndex(buffer: any[], array: boolean): void;
        /**
        * Returns the reference from the buffer to rsi register
        * @param buffer - The buffer reference
        * @param array - If true, it adds 1 to the ri (first slot is the length)
        */
        BufferToSourceIndex(buffer: any[], array: boolean): void;
    }

    /**
     * Object representing the TypeCON system framework
     * 
     * @property {number} ra - Accumulator register. Used for all kinds of operations. All results are stored in it.
     * @property {number} rb - Base register. Used for return values and sometimes as a helper in some operations.
     * @property {number} rc - Counter register. Used for loops.
     * @property {number} rd - Data registers. Used in if/binary expressions to hold the right side of the operation.
     * @property {number} rf - Flags register.
     * @property {number} ri - Index register. Holds the current index of the stack/heap memory during operations.
     * @property {number} rsi - Source Index register. In operations envolving 2 memory pointers, it usually holds the "source".
     * @property {number} rbp - Base pointer register. Holds the base of the current stack.
     * @property {number} rsp - Stack pointer register. Holds the current stack value.
     * @property {number} rssp - String Stack pointer register. Holds the current string stack value.
     * @property {number} rsbp - String Base pointer register. Hold the base of the current string stack.
     * @property {(number): [] | string} GetReference - Function to get the reference from a register.
     * @property {(any[], boolean): void} BufferToIndex - Returns the reference from the buffer to ri register
     * @property {(any[], boolean): void} BufferToSourceIndex - Returns the reference from the buffer to rsi register
     */
    export const sysFrame: CON_NATIVE_OBJECT<ISys>;

    /**
     * Copies a portion of a memory to another
     * @param source_buffer - The source buffer
     * @param dest_buffer - The destination buffer
     * @param num_dwords - Number of double words (32-bit) or 4 bytes to copy from source to destination
     */
    export function MemCopy(source_buffer: [], dest_buffer: [], num_dwords: number): CON_NATIVE<void>;

    export type TLabel = string; //Use this to define constants and pointers

    export interface pointer<T> { }

    /**
     * Breaks the system for debugging and logs a value to the console.
     * @param value The value to be logged.
     */
    export function CONBreak(value: constant): CON_NATIVE<void>;

    /**
     * Prints the stack and breaks the system for debugging
     */
    export function PrintStackAndBreak(): CON_NATIVE<void>;

    /**
     * Prints a value to the console
     */
    export function PrintValue(value: number): CON_NATIVE<void>;

    /**
     * quote type. In TypeCON, we have strings, which are kept inside the flat memory and can be converted
     * and then we have quotes, which are kept separately from the memory and are used in native CON commands.
     * quotes have a 128 character limitation.
     */
    export type quote = string & {
        readonly _brand: 'quote';
        /** Copy src into this quote slot (qstrcpy). */
        copy(src: quote): void;
        /** Append src to this quote slot (qstrcat). */
        cat(src: quote): void;
        /** Bounded append: append at most maxlen characters from src (qstrncat). */
        ncat(src: quote, maxlen: number): void;
        /** Character count of this quote slot (qstrlen). */
        len(): number;
        /** Copy a substring of src[start..end] into this quote slot (qsubstr). */
        sub(src: quote, start: number, end: number): void;
        /** Compare this quote to other; returns negative/0/positive like strcmp (qstrcmp). */
        cmp(other: quote): number;
    };

    /**
     * Converts a string to a quote
     * @param str String to be converted
     */
    export function Quote(str: string): quote;

    /**
     * Constant type. Only literals are accepted
     */
    export type constant = number & { __brandConstant?: never };

    /**
     * GameLabel — emits a CON `define NAME value` header line.
     * Use-sites emit the label NAME rather than the numeric literal.
     * Compatible with any CONSTANT argument position.
     *
     * @example
     * const TILE_EGG: GameLabel = 2165;
     * // → define TILE_EGG 2165
     */
    export type GameLabel = number;

    /**
     * Sound flags bitfield for `definesound`.
     */
    export enum SoundFlags {
        None        = 0,
        Loop        = 1,    // SF_LOOP: repeats if continually played
        Ambient     = 2,    // SF_MSFX: ambient effect; muted by ambience toggle
        LoopUntilStop = 3,  // SF_LOOP|SF_MSFX: loops until explicitly stopped
        PlayerVoice = 4,    // SF_TALK: player voice; affected by Speech volume slider
        Adult       = 8,    // SF_ADULT: muted when parental lock / non-adult mode active
        Global      = 16,   // SF_GLOBAL: audible from anywhere in the level
        OneInstance = 32,   // SF_ONEINST_INTERNAL: only one instance at a time (internal)
        Speech      = 64,   // SF_SPEECH: NPC speech; affected by Speech volume slider
        DukeTag     = 128,  // SF_DTAG: used in Duke-Tag mode
        Explosion   = 144,  // SF_GLOBAL|SF_DTAG: vanilla Duke3D explosion sound behaviour
    }

    /**
     * Sound definition — emits `define NAME slot` (if no id given) + `definesound` header lines.
     * The variable name becomes the sound label, usable anywhere a CONSTANT is accepted.
     *
     * @example
     * const GUN_SHOT: Sound = { file: 'gunshot.wav', pitchMin: 5, pitchMax: 10 };
     * // → define GUN_SHOT 0
     * //   definesound GUN_SHOT "gunshot.wav" 5 10 0 0 0
     */
    export type Sound = {
        id?: number | GameLabel;  // explicit slot; omit to auto-assign
        file: string;
        pitchMin?: number;
        pitchMax?: number;
        flags?: SoundFlags;
        dist?: number;
        vol?: number;
    };

    /**
     * Configuration object for `CGame.startup()`.
     * All 27 fields map directly to the CON `gamestartup` positional arguments.
     */
    export type CGameStartup = {
        maxHealth: number;
        maxArmor: number;
        maxSteroids: number;
        maxHoloduke: number;
        maxJetpack: number;
        maxScuba: number;
        maxBoots: number;
        maxFirstAid: number;
        initialHealth: number;
        initialArmor: number;
        maxAmmoPistol: number;
        maxAmmoShotgun: number;
        maxAmmoChaingun: number;
        maxAmmoRPG: number;
        maxAmmoShrinker: number;
        maxAmmoDevastator: number;
        maxAmmoLaser: number;
        maxAmmoFreeze: number;
        maxAmmoShrunk: number;
        maxAmmoHeat: number;
        maxAmmoExpander: number;
        damagePistol: number;
        damageShotgun: number;
        damageChaingun: number;
        damageRPG: number;
        damageMortar: number;
        damageGrenade: number;
    };

    /**
     * Extend CGame to configure the game's global settings.
     * All calls in the constructor emit CON header definitions.
     *
     * @example
     * class MyGame extends CGame {
     *   constructor() {
     *     super('My TC');
     *     this.skill(0, 'Easy');
     *     this.startup({ maxHealth: 100, ... });
     *     this.precache(false, TILE_WATER, TILE_WATER);
     *     this.cheat('dnkroz', GOD_CHEAT);
     *   }
     * }
     */
    export class CGame {
        constructor(name: string)
        skill(id: number, name: string): void
        startup(cfg: CGameStartup): void
        precache(external: boolean, startTile: number | GameLabel, endTile: number | GameLabel): void
        cheat(code: string, label: number | GameLabel): void
    }

    /**
     * Extend CVolume to define an episode (volume) and its levels.
     * All calls in the constructor emit CON header definitions.
     *
     * @example
     * class Ep1 extends CVolume {
     *   constructor() {
     *     super(0, 'L.A. Meltdown');
     *     this.level(1, 'e1l1.map', 'dethtoll.mid', 'Hollywood Holocaust');
     *     this.music(1, 'dethtoll.mid');
     *   }
     * }
     */
    export class CVolume {
        constructor(id: number, name: string)
        level(id: number, file: string, music: string, name: string, par?: number, des?: number): void
        music(lev: number, file: string): void
    }

    export interface IMapState {
        Save(): CON_NATIVE<void>;
        Load(): CON_NATIVE<void>;
        Clear(): CON_NATIVE<void>;
    }

    export type HitscanResult = { sector: number; wall: number; sprite: number; x: number; y: number; z: number; };
    export type NearTagResult = { sector: number; wall: number; sprite: number; dist: number; };
    export type ZRangeResult  = { ceilZ: number; ceilHit: number; florZ: number; florHit: number; };
    export type IntersectResult = { hit: number; x: number; y: number; z: number; };
    /** Time and date values returned by {@link GetTimeDate}. */
    export type TimeDate = { sec: number; min: number; hour: number; day: number; month: number; year: number; dayOfWeek: number; };

    export interface IMap {
        readonly level: CON_NATIVE_GAMEVAR<'LEVEL', number>;
        readonly volume: CON_NATIVE_GAMEVAR<'VOLUME', number>;
        readonly skill: CON_NATIVE_GAMEVAR<'SKILL', number>;
        /** Stop all currently playing music. */
        StopAllMusic(): CON_NATIVE<void>;
        /** Start playing a music track on the given volume slot. */
        StartTrack(slot: number, track: number): CON_NATIVE<void>;
        /** Get the current playback position (in samples) of the active music track. */
        GetMusicPosition(): CON_NATIVE<number>;
        /** Seek the active music track to the given sample position. */
        SetMusicPosition(pos: number): CON_NATIVE<void>;
        /** Returns the number of activated sectors with the given lo-tag that are currently moving. */
        CheckActivatorMotion(lotag: number): CON_NATIVE<number>;
        /** Returns the sector index that contains the given wall. */
        SectorOfWall(wall: number): CON_NATIVE<number>;
        /** Returns the sector index containing world point (x,y,z). */
        UpdateSectorZ(x: number, y: number, z: number): CON_NATIVE<number>;
        /** Returns the sector index containing (x,y), searching from neighboring sectors. */
        UpdateSectorNeighbor(x: number, y: number): CON_NATIVE<number>;
        /** Returns the sector index containing (x,y,z), searching from neighboring sectors. */
        UpdateSectorNeighborZ(x: number, y: number, z: number): CON_NATIVE<number>;
        /** Cast a hitscan ray from (x,y,z) in sector sect with direction (vx,vy,vz). */
        Hitscan(x: number, y: number, z: number, sect: number, vx: number, vy: number, vz: number, clipmask: number): CON_NATIVE<HitscanResult>;
        /** Find the nearest tagged wall/sector/sprite within range of (x,y,z). */
        NearTag(x: number, y: number, z: number, sect: number, ang: number, range: number, tagsearch: number): CON_NATIVE<NearTagResult>;
        /** Get the ceiling and floor Z extents at world point (x,y,z) in sector sect. */
        GetZRange(x: number, y: number, z: number, sect: number, walldist: number, clipmask: number): CON_NATIVE<ZRangeResult>;
        /** Return the sector index that contains world point (x,y). */
        UpdateSector(x: number, y: number): CON_NATIVE<number>;
        /** Floor Z at world position (x,y) in the given sector. */
        FloorZOfSlope(sect: number, x: number, y: number): CON_NATIVE<number>;
        /** Ceiling Z at world position (x,y) in the given sector. */
        CeilZOfSlope(sect: number, x: number, y: number): CON_NATIVE<number>;
        /** Move a wall vertex to (x,y). */
        DragPoint(wall: number, x: number, y: number): CON_NATIVE<void>;
        /** Activate sector movement for the given sector. */
        MoveSector(sect: number): CON_NATIVE<void>;
        /** 2D distance between two sprites (by sprite index). */
        Dist(s1: number, s2: number): CON_NATIVE<number>;
        /** Fast approximate 2D distance between two sprites. */
        LDist(s1: number, s2: number): CON_NATIVE<number>;
        /** Nearest actor of tile type within 2D radius; -1 if none. */
        FindNearActor(tile: CON_CONSTANT<number>, dist: number): CON_NATIVE<number>;
        /** Nearest actor of tile type within 3D radius; -1 if none. */
        FindNearActor3D(tile: CON_CONSTANT<number>, dist: number): CON_NATIVE<number>;
        /** Nearest actor of tile type within 2D radius and Z range; -1 if none. */
        FindNearActorZ(tile: CON_CONSTANT<number>, dist: number, zdist: number): CON_NATIVE<number>;
        /** Nearest sprite of tile type within 2D radius; -1 if none. */
        FindNearSprite(tile: CON_CONSTANT<number>, dist: number): CON_NATIVE<number>;
        /** Nearest sprite of tile type within 3D radius; -1 if none. */
        FindNearSprite3D(tile: CON_CONSTANT<number>, dist: number): CON_NATIVE<number>;
        /** Nearest sprite of tile type within 2D radius and Z range; -1 if none. */
        FindNearSpriteZ(tile: CON_CONSTANT<number>, dist: number, zdist: number): CON_NATIVE<number>;
        readonly numSectors:      CON_NATIVE_GAMEVAR<'NUMSECTORS', number>;
        readonly numWalls:        CON_NATIVE_GAMEVAR<'NUMWALLS', number>;
        readonly numSprites:      CON_NATIVE_GAMEVAR<'NUMSPRITES', number>;
        marker:           CON_NATIVE_GAMEVAR<'MARKER', number>;
        monstersOff:      CON_NATIVE_GAMEVAR<'MONSTERS_OFF', number>;
        ffire:            CON_NATIVE_GAMEVAR<'FFIRE', number>;
        respawnInventory: CON_NATIVE_GAMEVAR<'RESPAWN_INVENTORY', number>;
        respawnItems:     CON_NATIVE_GAMEVAR<'RESPAWN_ITEMS', number>;
        respawnMonsters:  CON_NATIVE_GAMEVAR<'RESPAWN_MONSTERS', number>;
        state: IMapState;
    }

    export interface IGameSession {
        readonly coop:           CON_NATIVE_GAMEVAR<'COOP', number>;
        readonly multiMode:      CON_NATIVE_GAMEVAR<'MULTIMODE', number>;
        gameTypeFlags:           CON_NATIVE_GAMEVAR<'gametype_flags', number>;
        readonly myConnectIndex: CON_NATIVE_GAMEVAR<'myconnectindex', number>;
        readonly numPlayers:     CON_NATIVE_GAMEVAR<'numplayers', number>;
        randomSeed:              CON_NATIVE_GAMEVAR<'randomseed', number>;
        screenPeek:              CON_NATIVE_GAMEVAR<'screenpeek', number>;
    }

    export interface IGameDisplay {
        readonly xDim:        CON_NATIVE_GAMEVAR<'xdim', number>;
        readonly yDim:        CON_NATIVE_GAMEVAR<'ydim', number>;
        readonly windowX1:    CON_NATIVE_GAMEVAR<'windowx1', number>;
        readonly windowX2:    CON_NATIVE_GAMEVAR<'windowx2', number>;
        readonly windowY1:    CON_NATIVE_GAMEVAR<'windowy1', number>;
        readonly windowY2:    CON_NATIVE_GAMEVAR<'windowy2', number>;
        readonly framerate:   CON_NATIVE_GAMEVAR<'framerate', number>;
        readonly totalClock:  CON_NATIVE_GAMEVAR<'totalclock', number>;
        rendMode:             CON_NATIVE_GAMEVAR<'rendmode', number>;
        yxAspect:             CON_NATIVE_GAMEVAR<'yxaspect', number>;
        viewingRange:         CON_NATIVE_GAMEVAR<'viewingrange', number>;
        displayMirror:        CON_NATIVE_GAMEVAR<'display_mirror', number>;
        currentMenu:          CON_NATIVE_GAMEVAR<'current_menu', number>;
        currentWeapon:        CON_NATIVE_GAMEVAR<'currentweapon', number>;
        gs:                   CON_NATIVE_GAMEVAR<'gs', number>;
        menuTile:             CON_NATIVE_GAMEVAR<'MENU_TILE', number>;
        gunPos:               CON_NATIVE_GAMEVAR<'gun_pos', number>;
        lookingAngSR1:        CON_NATIVE_GAMEVAR<'looking_angSR1', number>;
        lookingArc:           CON_NATIVE_GAMEVAR<'looking_arc', number>;
        weaponXOffset:        CON_NATIVE_GAMEVAR<'weapon_xoffset', number>;
        weaponCount:          CON_NATIVE_GAMEVAR<'weaponcount', number>;
    }

    export interface IGameCamera {
        ang:            CON_NATIVE_GAMEVAR<'cameraang', number>;
        readonly clock: CON_NATIVE_GAMEVAR<'cameraclock', number>;
        dist:           CON_NATIVE_GAMEVAR<'cameradist', number>;
        horiz:          CON_NATIVE_GAMEVAR<'camerahoriz', number>;
        sect:           CON_NATIVE_GAMEVAR<'camerasect', number>;
        x:              CON_NATIVE_GAMEVAR<'camerax', number>;
        y:              CON_NATIVE_GAMEVAR<'cameray', number>;
        z:              CON_NATIVE_GAMEVAR<'cameraz', number>;
    }

    export interface IGamePhysics {
        gravitationalConstant: CON_NATIVE_GAMEVAR<'gravitationalconstant', number>;
        clipMask0:             CON_NATIVE_GAMEVAR<'CLIPMASK0', number>;
        clipMask1:             CON_NATIVE_GAMEVAR<'CLIPMASK1', number>;
    }

    export interface IGameCombat {
        angRange:              CON_NATIVE_GAMEVAR<'ANGRANGE', number>;
        autoAimAngle:          CON_NATIVE_GAMEVAR<'AUTOAIMANGLE', number>;
        zRange:                CON_NATIVE_GAMEVAR<'ZRANGE', number>;
        grenadeLifetime:       CON_NATIVE_GAMEVAR<'GRENADE_LIFETIME', number>;
        grenadeLifetimeVar:    CON_NATIVE_GAMEVAR<'GRENADE_LIFETIME_VAR', number>;
        pipebombControl:       CON_NATIVE_GAMEVAR<'PIPEBOMB_CONTROL', number>;
        stickybombLifetime:    CON_NATIVE_GAMEVAR<'STICKYBOMB_LIFETIME', number>;
        stickybombLifetimeVar: CON_NATIVE_GAMEVAR<'STICKYBOMB_LIFETIME_VAR', number>;
        tripbombControl:       CON_NATIVE_GAMEVAR<'TRIPBOMB_CONTROL', number>;
    }

    export interface IGame {
        /** Milliseconds elapsed since the engine started. */
        getTicks(): CON_NATIVE<number>;
        readonly map: IMap;
        /** Transition to another level. */
        StartLevel(ep: number, level: number): CON_NATIVE<void>;
        /**
         * Save the current game state to a slot.
         * @param slot - save slot number
         * @param notify - if true, display the save notification (default: false)
         */
        Save(slot: number, notify?: boolean): CON_NATIVE<void>;
        /**
         * End the game after an optional delay.
         * @param delay - delay in game tics before ending (constant)
         */
        EndOfGame(delay: CON_CONSTANT<number>): CON_NATIVE<void>;
        /**
         * End the current level with the given exit type.
         * @param exitType - exit type constant (e.g. 0 = normal, -1 = secret)
         */
        EndOfLevel(exitType: CON_CONSTANT<number>): CON_NATIVE<void>;
        /**
         * (Re-)initialize the game timer to the given tick rate.
         * @param ticsPerSec - ticks per second (120 = default)
         */
        InitTimer(ticsPerSec: number): CON_NATIVE<void>;
        /**
         * Switch the active game palette.
         * @param pal - palette index
         */
        SetGamePalette(pal: number): CON_NATIVE<void>;
        /**
         * Start playing a cutscene animation.
         * @param animType - animation type constant (e.g. ANIM_INNARDS)
         */
        StartCutscene(animType: CON_CONSTANT<number>): CON_NATIVE<void>;
        /**
         * Returns true if the given cutscene animation is currently playing.
         * @param animType - animation type constant
         */
        IsCutscenePlaying(animType: CON_CONSTANT<number>): CON_NATIVE<boolean>;
        /**
         * Open a game menu.
         * @param menuType - menu type constant
         */
        CMenu(menuType: CON_CONSTANT<number>): CON_NATIVE<void>;
        readonly session: IGameSession;
        readonly display: IGameDisplay;
        readonly camera:  IGameCamera;
        readonly physics: IGamePhysics;
        readonly combat:  IGameCombat;
        logoFlags:        CON_NATIVE_GAMEVAR<'LOGO_FLAGS', number>;
    }

    export const game: CON_NATIVE_OBJECT<IGame>;

    /**
     * Returns a pointer for thhe specified label
     * @param name - Label (can be an action, move or AI)
     * @returns the pointer of that label
    */
    export function Label(name: string): pointer<any>;

    /**
     * Flags for movement.
     *
     * @enum {number}
     * @readonly
     * @property {number} faceplayer - Actor faces the player.
     * @property {number} geth - Use horizontal velocity.
     * @property {number} getv - Use vertical velocity.
     * @property {number} randomangle - Actor will face random direction.
     * @property {number} faceplayerslow - Same as faceplayer, but done gradually.
     * @property {number} spin - Spin in a clockwise circle.
     * @property {number} faceplayersmart - Same as faceplayer, but with a slight "lead" on position.
     * @property {number} fleeenemy - Actor faces away from the player.
     * @property {number} jumptoplayer - Actor will move vertically and then fall as if jumping.
     * @property {number} seekplayer - Actor will try to find the best path to the nearest player.
     * @property {number} furthestdir - Actor faces the furthest distance from the closest player.
     * @property {number} dodgebullet - Actor attempts to avoid all shots directed at him. The actor will not avoid GROWSPARK.
    */
    export enum EMoveFlags {
        faceplayer = 1,
        geth = 2,
        getv = 4,
        randomangle = 8,
        faceplayerslow = 16,
        spin = 32,
        faceplayersmart = 64,
        fleeenemy = 128,
        jumptoplayer = 257,
        seekplayer = 512,
        furthestdir = 1024,
        dodgebullet = 4096
    }


    /**
     * Enumeration for Operate function flags.
     *
     * Determines how the Operate function works by activating a specific element:
     * doors, activators, master switches, respawns, sectors, or all activators within a sector.
     * Only one flag should be set at a time.
     *
     * @enum {number}
     * @readonly
     * @property {number} doors - Activates doors.
     * @property {number} activators - Activates activators.
     * @property {number} master_switches - Activates master switches.
     * @property {number} respawns - Activates respawns.
     * @property {number} sectors - Activates sectors.
     * @property {number} all_activators_in_a_sector - Activates all activators within a sector.
     */
    export enum EOperateFlags {
        doors = 1,
        activators = 2,
        master_switches = 4,
        respawns = 8,
        sectors = 16,
        all_activators_in_a_sector = 32
    }


    export enum CON_NATIVE_TYPE {
        global = 1,
        actor = 2,
        player = 4,
        variable = 8
    }

    /**
     * Interface representing an action.
     *
     * Use this interface to create actions within the system.
     *
     * Available properties:
     * @property {number} start - The start point from the actor's tile number.
     * @property {number} length - The length of the animation.
     * @property {number} viewType - The type of sprite view. Valid values are 1, 3, 5, 7, or 8.
     * @property {number} incValue - The incremental value per tick. Use values 1, 0, or -1.
     * @property {number} delay - The delay for the action.
     *   - [0,3]: Minimum delay, equal to the tic counter.
     *   - [4,7]: 1/2 of the tic counter delay.
     *   - [8,11]: 1/3 of the tic counter delay.
     *   - [12,15]: 1/4 of the tic counter delay.
     *   - [16,19]: 1/5 of the tic counter delay; etc.
     *
     * @interface IAction
     */
    export interface IAction {
        /**
         * The byte-code pointer
         */
        loc?: number;
        /**
         * The start point from the actor's tile number.
         *
         * @type {number}
         */
        start: number;

        /**
         * The length of the animation.
         *
         * @type {number}
         */
        length: number;

        /**
         * The type of sprite view.
         *
         * Valid values are 1, 3, 5, 7, or 8.
         *
         * @type {number}
         */
        viewType: number;

        /**
         * The incremental value per tick.
         *
         * Use values 1, 0, or -1.
         *
         * @type {number}
         */
        incValue: number;

        /**
         * The delay for the action.
         *
         * Delay is defined as:
         * - [0,3]: Minimum delay, equal to the tic counter.
         * - [4,7]: 1/2 of the tic counter delay.
         * - [8,11]: 1/3 of the tic counter delay.
         * - [12,15]: 1/4 of the tic counter delay.
         * - [16,19]: 1/5 of the tic counter delay; etc.
         *
         * @type {number}
         */
        delay: number;
    }

    export type TAction<
        K extends string    // the keys you want suggested
    > = {
        [P in K]: IAction;       // suggested keys
    } & {
        [key: string]: IAction;   // fallback for any string
    };

    /**
     * Interface for declaring moves.
     *
     * Use this interface to define moves within the system.
     *
     * Available properties:
     * @property {number} horizontal_vel - Horizontal velocity.
     * @property {number} vertical_vel - Vertical velocity (use negative values for up).
     *
     * @interface IMove
     */
    export interface IMove {
        /**
         * The byte-code pointer
         */
        loc?: number;
        /**
         * Horizontal velocity.
         *
         * @type {number}
         */
        horizontal_vel: number;

        /**
         * Vertical velocity (use negative values for up).
         *
         * @type {number}
         */
        vertical_vel: number;
    }

    export type TMove<
        K extends string    // the keys you want suggested
    > = {
        [P in K]: IMove;       // suggested keys
    } & {
        [key: string]: IMove;   // fallback for any string
    };

    /**
     * Interface for declaring AIs.
     *
     * Use this interface to define AI configurations within the system.
     *
     * Available properties:
     * @property {IAction} action - The action for this AI.
     * @property {IMove} move - The move for the AI.
     * @property {EMoveFlags} flags - The move flags.
     *
     * @interface IAi
     */
    export interface IAi {
        /**
         * The byte-code pointer
         */
        loc?: number;
        /**
         * The action for this AI.
         *
         * @type {IAction}
         */
        action: IAction;

        /**
         * The move for the AI.
         *
         * @type {IMove}
         */
        move: IMove;

        /**
         * The move flags.
         *
         * @type {EMoveFlags}
         */
        flags: EMoveFlags;
    }

    export type TAi<
        K extends string    // the keys you want suggested
    > = {
        [P in K]: IAi;       // suggested keys
    } & {
        [key: string]: IAi;   // fallback for any string
    };

    /**
     * Frees a memory allocation
     * @param buffer - a pointer or reference to that memory
     */
    export function Delete(buffer: []): void;

    /**
     * Frees a memory allocation
     * @param buffer - a pointer or reference to that memory
     */
    export function Free(buffer: []): void;

    /**
     * Generates a 'safe' native CON code written by hand
     * @param native_code - the CON code
     */
    export function CON(native_code: string): void;

    /**
     * Generates a UNSAFE native CON code written by hand
     * @param native_code - the CON code
     */
    export function CONUnsafe(native_code: string): void;

    //Global functions

    /**
     * Returns if the player is currently in that state
     * @param state - the state that needs to be checked
     * @returns if true or not
     */
    export function IsPlayerState(state: constant): CON_NATIVE<boolean>;

    /**
     * Display on the screen using the traditional quote system the string referenced
     * @param quote - the string you want to be shown
     */
    export function DisplayQuote(quote: quote): CON_NATIVE<void>;

    //Global readonly variables

    /** The window width */
    export const xDim: CON_NATIVE_GAMEVAR<'xdim', number>;
    /** the window height */
    export const yDim: CON_NATIVE_GAMEVAR<'ydim', number>;
    /** The weapon x offset (used for weapon bobbing) */
    export const weaponXOff: CON_NATIVE_GAMEVAR<'weapon_xoffset', number>;
    /** the Counter for HUD weapon animations */
    export const weaponCount: CON_NATIVE_GAMEVAR<'weaponcount', number>;
    /** The totalclock counter for the game (by default, 120 is a second) */
    export const totalClock: CON_NATIVE_GAMEVAR<'totalclock', number>;
    /** The weapon y position. Use this to lower the HUD sprite */
    export const gunPos: CON_NATIVE_GAMEVAR<'gun_pos', number>;
    /** Used in weapon bobbing */
    export const lookingArc: CON_NATIVE_GAMEVAR<'looking_arc', number>;
    /** Contains the current ID of the current actor */
    export const thisActor: CON_NATIVE_GAMEVAR<'THISACTOR', number>;

    export var returnVar: CON_NATIVE_GAMEVAR<'RETURN', number>;

    /**
     * Plays an action and starts a movement without chaning the AI
     * @param action The action to be played
     * @param move The movement to be started
     * @param flags The movement flags
     */
    export function ActionAndMove(action: IAction | null, move: IMove | null, flags: number): CON_NATIVE_STATE<'__spriteFuncs_ActionAndMove'>;
    /**
     * Conditioning check if it's in sprite can see the player, if can shoot the player and checks it's distance
     * @param distance the distance to be checked
     * @param greater if wanted to check if the distance is greater or less equal
     */
    export function CanSeeShootInDist(distance: number, greater: boolean): CON_NATIVE_STATE<'__spriteFuncs_CanSeeShootInDist'>;

    /**
     * Checks if a certain respawn mode is enabled.
     * Monsters (hard-coded actors and useractors check RESPAWN_MONSTERS,
     * inventory items (hard-coded) check RESPAWN_INVENTORY and everything else checks RESPAWN_ITEMS.
     * By default, inventory items always respawn in multiplayer - cooperative or dukematch (no spawn) - although
     * they are assigned as such through hard-coded actors.
     * If you desire to add your own Inventory icon, you will need to check RESPAWN_INVENTORY gamevar
     * instead of using ifrespawn command.
     */
    export function IsRespawnActive(): CON_NATIVE<boolean>;

    /**
     * This is used to flash the screen a given color.
     * @param r the red value (0 - 63)
     * @param g the green value (0 - 63)
     * @param b the blue value (0 - 63)
     * @param time the amount of time to flash (0 - 63)
     */
    export function PalFrom(r: number, g: number, b: number, time: number): CON_NATIVE<void>;

    /** Stop all currently playing sound effects. */
    export function StopAllSounds(): CON_NATIVE<void>;
    /** Stop a specific sound effect globally. */
    export function StopSound(sound_id: number | Sound): CON_NATIVE<void>;
    /** Returns true if the given sound is currently playing. */
    export function IsSoundPlaying(sound_id: number | Sound): CON_NATIVE<boolean>;
    /** Display the user-defined quote at slot index. */
    export function UserQuote(slot: number): CON_NATIVE<void>;

    /** Returns the current time and date as a {@link TimeDate} object. */
    export function GetTimeDate(): CON_NATIVE<TimeDate>;

    /** Returns true if sprite spr1 has line-of-sight to sprite spr2. */
    export function CheckSpriteSight(spr1: number, spr2: number): CON_NATIVE<boolean>;

    // ── Sprite linked-list traversal ──────────────────────────────────────────
    /** First sprite in the given status list; returns -1 if empty. */
    export function headSpritestat(stat: number): CON_NATIVE<number>;
    /** Next sprite after spr in its status list; returns -1 at end. */
    export function nextSpritestat(spr: number): CON_NATIVE<number>;
    /** Previous sprite before spr in its status list; returns -1 at start. */
    export function prevSpritestat(spr: number): CON_NATIVE<number>;
    /** First sprite in the given sector; returns -1 if empty. */
    export function headSpritesect(sect: number): CON_NATIVE<number>;
    /** Next sprite after spr in its sector list; returns -1 at end. */
    export function nextSpritesect(spr: number): CON_NATIVE<number>;
    /** Previous sprite before spr in its sector list; returns -1 at start. */
    export function prevSpritesect(spr: number): CON_NATIVE<number>;

    export interface IActorPlayer {
        /** Add ammo to the interacting player's weapon slot. */
        AddAmmo(weapon: CON_CONSTANT<number>, amount: number): CON_NATIVE<void>;
        /** Add an inventory item to the interacting player. */
        AddInventory(item: CON_CONSTANT<number>, amount: number): CON_NATIVE<void>;
        /** Give the interacting player a weapon with ammo. */
        AddWeapon(weapon: number, ammo: number): CON_NATIVE<void>;
        /** Add health to the interacting player (clamped). */
        AddHealth(n: number): CON_NATIVE<void>;
        /** Get the current max-ammo cap for a weapon. */
        GMaxAmmo(weapon: number): CON_NATIVE<number>;
        /** Set the starting max-ammo cap for a weapon. */
        SMaxAmmo(weapon: number, max: number): CON_NATIVE<void>;
        /** Toss the interacting player's active weapon. */
        TossWeapon(): CON_NATIVE<void>;
        /** Make the interacting player flinch/recoil. */
        WackPlayer(): CON_NATIVE<void>;
        /** Stomp the sprite below the interacting player. */
        Pstomp(): CON_NATIVE<void>;
    }

    /** @class for actor declaration. Use this as extension to declare your custom actors. */
    export class CActor {
        public defaultStrength: CON_NATIVE<number>;
        public defaultPicnum: CON_NATIVE<number>;
        /** The current tile number of this actor */
        public picnum: CON_NATIVE<number>;
        /** Not accessible outside the constructor */
        private isEnemy: boolean;
        /** The 'health' of this actor */
        public extra: CON_NATIVE<number>;
        /** How much damage it took */
        public htExtra: CON_NATIVE<number>;
        /** How much damage it took */
        public damage: CON_NATIVE<number>;
        /** Which projectile damaged */
        public htPicnum: CON_NATIVE<number>;
        /** Which projectile damaged */
        public weaponHit: CON_NATIVE<number>;

        /** The current distance from the nearest player */
        public playerDist: CON_NATIVE<number>;

        /** The current action pointer */
        public curAction: CON_NATIVE<number>;
        /** The current action frame */
        public curActionFrame: CON_NATIVE<number>;
        /** The current move pointer */
        public curMove: CON_NATIVE<number>;
        /** The current velocity {x: xvel, y: yvel, z: zvel} */
        public vel: CON_NATIVE<vec3>;
        /** The current actor's angle */
        public ang: CON_NATIVE<number>;
        /** The current position */
        public pos: CON_NATIVE<vec3>;
        /** The current AI pointer */
        public curAI: CON_NATIVE<number>;
        /** The current palette used by the actor */
        public pal: CON_NATIVE<number>;
        /** Shade/brightness */
        public shade: CON_NATIVE<number>;
        /** Condition status flags */
        public cstat: CON_NATIVE<number>;
        /** Sprite status number */
        public statnum: CON_NATIVE<number>;
        /** Clipping distance */
        public clipDist: CON_NATIVE<number>;
        /** Owner sprite index */
        public owner: CON_NATIVE<number>;
        /** Repeat scaling {x: xrepeat, y: yrepeat} */
        public repeat: CON_NATIVE<vec2>;
        /** Texture offset {x: xoffset, y: yoffset} */
        public offset: CON_NATIVE<vec2>;
        /** Previous position {x: htbposx, y: htbposy, z: htbposz} */
        public prevPos: CON_NATIVE<vec3>;
        /** Ceiling collision Z */
        public htCeilingZ: CON_NATIVE<number>;
        /** Floor collision Z */
        public htFloorZ: CON_NATIVE<number>;
        /** Actor stay-put sector */
        public htActorStayPut: CON_NATIVE<number>;
        /** Actor angle (httype) */
        public htAng: CON_NATIVE<number>;
        /** Last X velocity */
        public htLastVX: CON_NATIVE<number>;
        /** Last Y velocity */
        public htLastVY: CON_NATIVE<number>;
        /** Movement flags */
        public htMovFlag: CON_NATIVE<number>;
        /** Temporary angle */
        public htTempAng: CON_NATIVE<number>;
        /** Time until actor sleeps */
        public htTimeToSleep: CON_NATIVE<number>;
        /** httype fields grouped: stayPutSector, lastAngle, lastVelX/Y, moveFlag, tempAngle, timeToSleep, ceilingZ, floorZ */
        public hitType: CON_NATIVE<{ stayPutSector: number; lastAngle: number; lastVelX: number; lastVelY: number; moveFlag: number; tempAngle: number; timeToSleep: number; readonly ceilingZ: number; readonly floorZ: number; }>;
        /** Projectile hit results: wall, sector, sprite (htg_t 6-8) */
        public hitInfo: CON_NATIVE<{ wall: number; sector: number; sprite: number; }>;
        /** Times the actor has looped through the current action (htg_t 0) */
        public curCount: CON_NATIVE<number>;
        /** Times the current action has executed (htg_t 2) */
        public curActionCount: CON_NATIVE<number>;
        /** Pitch rotation (spriteext) */
        public pitch: CON_NATIVE<number>;
        /** Roll rotation (spriteext) */
        public roll: CON_NATIVE<number>;
        /** Angular offset (spriteext) */
        public angOff: CON_NATIVE<number>;
        /** Alpha transparency (spriteext) */
        public alpha: CON_NATIVE<number>;
        /** Model display flags (spriteext) */
        public mdFlags: CON_NATIVE<number>;
        /** The current sector object */
        public curSector: CON_NATIVE<ISector>;
        /** The current sector ID */
        public curSectorID: CON_NATIVE<number>;
        /** The special flags active for the sprite */
        public flags: CON_NATIVE<number>;
        /** SFLAG_* bits — write-only; controls behaviour flags like SFLAG_BADGUY, SFLAG_SHADOW, etc. */
        public spriteflags: CON_NATIVE<number>;
        /** The Lotag and Hitag of the sprite */
        public tags: CON_NATIVE<tag>;
        public blend: CON_NATIVE<number>;
        public readonly uloTag: CON_NATIVE<number>;
        public readonly uhiTag: CON_NATIVE<number>;
        public htCgg: CON_NATIVE<number>;
        public htOwner: CON_NATIVE<number>;
        public readonly htUMovFlag: CON_NATIVE<number>;
        public htFloorZOffset: CON_NATIVE<number>;
        public htWaterZOffset: CON_NATIVE<number>;
        public htDispPicnum: CON_NATIVE<number>;
        public readonly isValid: CON_NATIVE<number>;
        public xPanning: CON_NATIVE<number>;
        public yPanning: CON_NATIVE<number>;
        public mdXOff: CON_NATIVE<number>;
        public mdYOff: CON_NATIVE<number>;
        public mdZOff: CON_NATIVE<number>;
        public mdPosXOff: CON_NATIVE<number>;
        public mdPosYOff: CON_NATIVE<number>;
        public mdPosZOff: CON_NATIVE<number>;

        protected index: number;

        /**
         * You must call this to begin the actor's declaration
         * @param picnum - the current actor's tile number
         * @param isEnemy - if it's an enemy or not
         * @param extra - the health
         * @param no_labelobj - true by default. Use false if you don't want the complete label declaration in memory as objects
         * @param actor_hardcode - set to true if it's a hard coded actor
         */
        constructor(
            picnum: constant,
            isEnemy: boolean,
            extra: constant,
            no_labelobj?: boolean,
            actor_hardcode?: boolean
        )

        protected actions: TAction<string>;
        protected moves: TMove<string>;
        protected ais: TAi<string>;

        /** Player-interaction commands — act on the player currently interacting with this actor. */
        public readonly player: IActorPlayer;

        /**
         * Play an action
         * @param action - the IAction object declared for this class
         */
        public PlayAction(action: IAction | null): CON_NATIVE<void>
        /**
         * Move the actor
         * @param move - the IMove object declared for this class
         * @param flags - the movement flags
         */
        public Move(move: IMove | null, flags: number): CON_NATIVE<void>
        /**
         * Start the AI configuration for this actor
         * @param ai - the IAi object declared for this class
         */
        public StartAI(ai: IAi | null): CON_NATIVE<void>
        /**
         * Set or get the current stat for the actor
         * @param stats - The stats to be set or leave blank it to only return the current value
         * @returns - the current actor's stat value
         */
        public CStat(stats?: number): CON_NATIVE<number>
        /**
         * OR the stat value to the actor's stat
         * @param stats - The stats to be set
         */
        public CStatOR(stats: number): CON_NATIVE<void>
        /**
         * Immediately set the size for this particular actor
         * @param w - the width (0 - 255)
         * @param h - the height(0 - 255)
         */
        public SizeAt(w: number, h: number): CON_NATIVE<void>
        /**
         * Sets the size for this particular actor by incrementing the width and height by @param inc_x and @param inc_y each tick
         * @param w - the maximum width
         * @param h - the maximum height
         * @param inc_x - how much to increment the width each tick
         * @param inc_y - how much to increment the height each tick
         */
        public SizeTo(w: number, h: number, inc_x?: number, inc_y?: number): CON_NATIVE<void>
        /**
         * Set or gets the native counter for this actor
         * @param value - Set the counter to this value. Leave blank to just retrieve the current counter value
         * @returns - the current counter value
         */
        public Count(value?: number): CON_NATIVE<number>
        /**
        * Set or gets the native action counter for this actor
        * @param value - Set the ation counter to this value. Leave blank to just retrieve the current action counter value
        * @returns - the current action counter value
        */
        public ActionCount(value?: number): CON_NATIVE<number>
        /**
         * Gets the current distance from the ceiling
         * @returns - the distance right shifted to 8
         */
        public CeilingDist(): CON_NATIVE<number>
        /**
        * Gets the current distance from the floor
        * @returns - the distance right shifted to 8
        */
        public FloorDist(): CON_NATIVE<number>
        /**
         * Gets the current gap distance from floor to ceiling
         * @returns - the distance right shifted to 8
         */
        public GapDist(): CON_NATIVE<number>
        /**
         * Enables 'physics' for this actor
         */
        public Fall(): CON_NATIVE<void>
        /**
         * Returns the last pal value used before the current one
         */
        public GetLastPal(): CON_NATIVE<void>
        /**
         * Deletes the actor from the game world
         */
        public KillIt(): CON_NATIVE<void>
        /** Use this to stop the current actor's process */
        public Stop(): CON_NATIVE<void>
        /** Reset's the action counter */
        public ResetAction(): CON_NATIVE<void>
        /**
         * Spawn a actor
         * @param picnum - The tile number of the actor 
         * @param initFn - (optional) a function to run after the actor has been spawned to initialize it
         * @param queued - (optional) Set this to true if you want it to become part of the queue system
         * @returns - the ID of the actor spawned
         */
        public Spawn(picnum: number | CActor, initFn?: ((id: number) => void), queued?: boolean): CON_NATIVE<number>
        /**
         * Shoots a projectile
         * @param picnum - The projectile's tile number
         * @param initFn - (optional) a function to run after the projectile has been shot to initialize it
         * @param use_zvel - (optional) Shoot with vertical veliocity
         * @param zvel - (optional) the vertical velocity - must set @param use_zvel to true
         * @param additive_zvel - (optional) Set this to true to add your vertical velocity to the actor's already set
         */
        public Shoot(picnum: number | CActor, initFn?: ((id: number) => void), use_zvel?: boolean, zvel?: number, additive_zvel?: boolean): CON_NATIVE<number>
        /**
         * Damages all actors and sectors in a radius (divided into 4 ranges)
         * @param radius - The maximum radius
         * @param furthestDmg - The furthest range damage
         * @param farDmg - The far range damage
         * @param closeDmg - the close range damage
         * @param closestDmg - the closest range damage
         */
        public HitRadius(radius: number, furthestDmg: number, farDmg: number, closeDmg: number, closestDmg: number): CON_NATIVE<void>
        /**
         * Flashes for a brief second some visible sectors
         */
        public Flash(): CON_NATIVE<void>
        /**
         * Activates 9 or less respawn sprites with a lotag matching the current actor's hitag.
         */
        public RespawnHitag(): CON_NATIVE<void>
        /**
         * Causes the current actor to ope/activate a nearby door, activator, master switch, sector or sector effector.
         * @param flags - which entity to activate
         * @param lotag - (optional - depends on what flag is set) the lotag to activate activators or master switches
         * @param player_id - (optional) the player ID from whom should do the call
         * @param sector - (optional) the sector ID to be used
         * @param sprite - the sprite ID to be used
         */
        public Operate(flags: EOperateFlags, lotag?: number, player_id?: number, sector?: number, sprite?: number): CON_NATIVE<void>
        /**
         * Plays a sound
         * @param sound_id - the sound ID 
         * @param global - play globally or not
         * @param once (optional) - only play it again if the other instance has finished already
         */
        public Sound(sound_id: number | Sound, global?: boolean, once?: boolean): CON_NATIVE<void>
        /**
         * Stop a sound playing on this actor.
         * @param sound_id - the sound ID or Sound label
         */
        public StopActorSound(sound_id: number | Sound): CON_NATIVE<void>
        /**
         * Returns true if this actor is currently playing the given sound.
         * @param sound_id - the sound ID or Sound label
         */
        public IsActorSound(sound_id: number | Sound): CON_NATIVE<boolean>
        /**
         * Set the pitch of a sound playing on this actor.
         * @param sound_id - the sound ID or Sound label
         * @param pitch - pitch value
         */
        public SetActorSoundPitch(sound_id: number | Sound, pitch: number): CON_NATIVE<void>
        /**
         * Returns if the actor is away from wall
         */
        public IsAwayFromWall(): CON_NATIVE<boolean>
        /**
         * Returns if the actor is in the water
         */
        public IsInWater(): CON_NATIVE<boolean>
        /**
         * Returns if the actor is on the water
         */
        public IsOnWater(): CON_NATIVE<boolean>
        /**
         * Checks if the current actor is in a sector with a parallaxed ceiling (sky).
         */
        public IsOutside(): CON_NATIVE<boolean>
        /**
         * Checks if the actor is in space
         */
        public IsInSpace(): CON_NATIVE<boolean>
        /**
         * Checks if the actor is in outer space
         */
        public IsInOuterSpace(): CON_NATIVE<boolean>
        /**
         * A function condition stating the probability of it 'doin somethin!' in this case.
         * A @param value greater or equal to 255 corresponds to a 100% probability that the first block is taken.
         * With a @param value of -1, the "else" block is taken every time.(A <value> of 0 means taking the "if" block once out of 256 on average).
         * This command must only be used in synchronised code or you will cause desyncs.
         * For display code use displayrand instead.
         * @param value - the value of chance (0 - 255)
         */
        public IsRandom(value: number): CON_NATIVE<boolean>
        /**
         * Checks if the current actor is dead (health is zero or below)
         */
        public IsDead(): CON_NATIVE<boolean>
        /**
         * Checks if the actor has been suished by a sector
         */
        public Squished(): CON_NATIVE<boolean>
        /**
         * Checks if the actor is moving
         */
        public IsItMoving(): CON_NATIVE<boolean>
        /**
         * Returns 'true' if a projectile is near the actor.
         * In the case of hitscan projectiles (such as SHOTSPARK1),
         * it returns true if the point of impact is near the player.
         */
        public BulletNear(): CON_NATIVE<boolean>
        /**
         * Checks if the current actor was struck by a weapon.
         * Built-in damage processing occurs when using @method HitByWeapon, so it must be called frequently
         * in actor code in order for the actor to be affected by projectiles.
         */
        public HitByWeapon(): CON_NATIVE<boolean>
        /**
         * If condition returning true if there is a line of sight between the current actor and the player.
         * The difference with @method CanSeeTarget is that @method CanSee actually verifies if the player
         * can see any actual part of the current actor tile (and basically would be hard to the player say
         * how an enemy looked alike while standing except if he use F7 view mode),
         * while @method CanSeeTarget verify if the current actor has "eye contact" with the player
         * (and in result the player is capable of viewing a arm or a litoral part of an enemy without
         * it targeting the player).
         */
        public CanSee(): CON_NATIVE<boolean>
        /**
         * If condition returning true if the current actor can see the player.
         */
        public CanSeeTarget(): CON_NATIVE<boolean>
        /**
         * If condition returning true if the current actor can shoot the player.
         */
        public CanShootTarget(): CON_NATIVE<boolean>
        /**
         * Checks to see if the player has pressed the open button (space by default).
         */
        public PlayerHitSpace(): CON_NATIVE<boolean>
        /**
         * Goes with @method HitByWeapon. Returns which projectile hit the actor.
         */
        public WhichWeaponHit(): CON_NATIVE<number>

        /**
         * Calculates the angle necessary for the current sprite to face whatever target is
         * or was at the coordinates htlastvx and htlastvy.
         */
        public AngleToTarget(): CON_NATIVE<number>
        /** Returns the 2D distance to the nearest player. */
        public FindPlayer(): CON_NATIVE<number>
        /** Plays the player tip-hat animation. */
        public Tip(): CON_NATIVE<void>

        /**
         * Spawns the hard-coded debris. Scraps inherit the owner palette.
         * @param tile - the tile number of the debris can be SCRAP1 through SCRAP6 (see {@link Names}).
         * @param amount - the amount of debris to spawn
         */
        public Debris(tile: constant, amount: constant): CON_NATIVE<void>
        /**
         * Spawns the hard-coded gore.
         * @param tile - the tile number of the gut, can be JIBS1 through JIBS6, HEADJIB, LEGJIB... (See {@link Names})
         * @param amount - the amount of guts to spawn
         */
        public Guts(tile: constant, amount: constant): CON_NATIVE<void>
        /**
         * Causes the current actor to spawn @param amount envelopes.
         * @param amount - the amount of envelopes to spawn
         */
        public Mail(amount: constant): CON_NATIVE<void>
        /**
         * Attracts the ladies. Well, no, not really, at least not in the game.
         * Spawns @param amount of dollar bills.
         * @param amount - the amount of money to spawn
         */
        public Money(amount: constant): CON_NATIVE<void>
        /**
         * Spawns @param amount of pieces of paper to use the same type of movement of the money command.
         * @param amount - the amount of paper to spawn
         */
        public Paper(amount: constant): CON_NATIVE<void>
        /**
         * Causes the current actor to spawn @param amount of broken glass pieces.
         * NOTE: If @method Pal is used right before this command, it will change the glass palette as well.
         * @param amount - the amount of glass to spawn
         */
        public Glass(amount: constant): CON_NATIVE<void>
        /**
         * Changes the current actor's palette reference number to @param color.
         * @param color - the palette to change
         */
        public Pal(color: number): CON_NATIVE<void>

        /**
         * Add @param amount to the kill counter
         * @param amount - how many kills to add
         */
        public AddKills(amount: constant): CON_NATIVE<void>
        /**
         * Makes the player kick
         */
        public PlayerKick(): CON_NATIVE<void>
        /**
         * Locks the player movement by @param time amount of time
         * @param time - the amount of time to lock the player
         */
        public LockPlayer(time: number): CON_NATIVE<void>
        /**
         * Reload the map (if in Single Player) and the player loses his inventory.
         * Also if in Single Player mode, execution of subsequent code is halted in a fashion similar to return.
         * @param flags - set to 1 to don't ask the player if they want to load the most recent save (if applicable)
         */
        public ResetPlayer(flags: number): CON_NATIVE<void>
        /**
         * Move this actor using its own xvel/yvel without recalculating the angle.
         * @param clipType - clipping mask (e.g. CLIPMASK0, CLIPMASK1)
         */
        public SSP(clipType: number): CON_NATIVE<void>
        /** Insert this actor into the sprite-processing queue. */
        public InsertQueue(): CON_NATIVE<void>
        /**
         * Trigger a screen quake.
         * @param strength - quake magnitude
         */
        public Quake(strength: number): CON_NATIVE<void>
        /** Show the startup screen. */
        public StartScreen(): CON_NATIVE<void>

        /**
         * You must define this function for the actor to work
         */
        protected Main(first_action?: IAction): void;

        /**
         * Per-actor events. See {@link OnEvent}
         */
        protected Events: OnEvent;

        protected Variations: OnVariation<CActor | any>;
    }

    /** Other sprites in the game world */
    export const sprites: CActor[];

    export type TEventPAE =
        'Game' | 'EGS' | 'Spawn' | 'KillIt' |
        'ResetPlayer' | 'LoadActor' | 'IncurDamage' |
        'FakeDoMoveThings' | 'World' | 'PreWorld' |
        'MoveSector' | 'MoveEffectors' |
        'RecogSound' | 'Sound' |
        'CheckTouchDamage' | 'CheckFloorDamage' | 'DamageHPlane' |
        'DamageSprite' | 'PostDamageSprite' | 'DamageWall' | 'DamageFloor' | 'DamageCeiling' |
        'ResetGotPics' | 'OperateActivators' | 'PreActorDamage';

    export type TEventDE =
        'AnimateSprites' |
        'DisplayRest' | 'DisplayStart' | 'DisplayEnd' |
        'DisplaySBar' | 'DisplayCrosshair' |
        'DisplayRooms' | 'DisplayRoomsEnd' | 'DisplayRoomsCamera' | 'DisplayRoomsCameraTile' |
        'DisplayBonusScreen' |
        'DisplayMenu' | 'DisplayMenuRest' | 'DisplayInactiveMenu' | 'DisplayInactiveMenuRest' |
        'DisplayLoadingScreen' |
        'DisplayCursor' | 'DisplayLevelStats' | 'DisplayCameraOsd' |
        'DisplaySpit' | 'DisplayFist' | 'DisplayKnee' | 'DisplayKnuckles' |
        'DisplayScuba' | 'DisplayTip' | 'DisplayAccess' |
        'DisplayOverheadMapText' | 'DisplayOverheadMapPlayer' |
        'DisplayPointer' | 'DisplayBorder' |
        'DisplayWeapon' |
        'Screen' | 'UpdateScreenArea';

    export type TEventIE =
        'LookLeft' | 'LookRight' | 'SoarUp' | 'SoarDown' |
        'Crouch' | 'Jump' | 'ReturnToCenter' |
        'LookUp' | 'LookDown' | 'AimUp' | 'AimDown' |
        'TurnLeft' | 'TurnRight' | 'TurnAround' |
        'StrafeLeft' | 'StrafeRight' |
        'MoveForward' | 'MoveBackward' |
        'SwimUp' | 'SwimDown' |
        'Use' | 'ProcessInput' |
        'PreUpdateAngles' | 'PostUpdateAngles';

    export type TEventWE =
        'WeapKey1' | 'WeapKey2' | 'WeapKey3' | 'WeapKey4' | 'WeapKey5' |
        'WeapKey6' | 'WeapKey7' | 'WeapKey8' | 'WeapKey9' | 'WeapKey10' |
        'DoFire' | 'PressedFire' | 'Fire' | 'AltFire' | 'AltWeapon' |
        'FireWeapon' | 'PreWeaponShoot' | 'PostWeaponShoot' |
        'SelectWeapon' | 'ChangeWeapon' | 'PreviousWeapon' | 'NextWeapon' | 'LastWeapon' |
        'DrawWeapon' | 'Holster' | 'QuickKick' |
        'GetShotRange' | 'GetAutoAimAngle';

    export type TEventPIE =
        'Inventory' | 'InventoryLeft' | 'InventoryRight' |
        'UseNightVision' | 'UseSteroids' |
        'HoloDukeOn' | 'HoloDukeOff' |
        'UseMedkit' | 'UseJetpack' |
        'ResetInventory' | 'ResetWeapons';

    export type TEventME =
        'Init' | 'InitComplete' |
        'EnterLevel' | 'PreLevel' | 'NewGame' | 'PreGame' | 'NewGameCustom' |
        'LoadGame' | 'SaveGame' | 'PreLoadGame' | 'PostSaveGame' |
        'Logo' |
        'ActivateCheat' |
        'CheatGetSteroids' | 'CheatGetHeat' | 'CheatGetBoot' | 'CheatGetShield' |
        'CheatGetScuba' | 'CheatGetHoloduke' | 'CheatGetJetpack' | 'CheatGetFirstAid' |
        'ChangeMenu' | 'OpenMenuSound' |
        'SetDefaults' |
        'MainMenuScreen' | 'NewGameScreen' | 'EndLevelScreen' | 'ExitGameScreen' | 'ExitProgramScreen' |
        'CutScene' | 'PreCutScene' | 'SkipCutScene' |
        'PlayLevelMusicSlot' | 'ContinueLevelMusicSlot' |
        'MenuCursorLeft' | 'MenuCursorRight' | 'MenuCursorShade' | 'MenuShadeSelected' |
        'GetLoadTile' | 'GetMenuTile' | 'GetBonusTile' |
        'Capir' | 'ValidateStart';

    export type TEvents = TEventPAE | TEventDE | TEventIE | TEventWE | TEventPIE | TEventME;

    export type OnEvent = Partial<{
        [E in TEvents]: (
            this: CEvent<E> & CActor
        ) => void | number;
    }>;

    export type OnVariation<C> = Record<string, {
        (this: C): {
            picnum: constant,
            extra: constant,
            first_action?: IAction
        };
    }>

    /**
     * Base class for event handlers.
     *
     * Extend with an explicit type argument to get the right method set:
     *   - `CEvent<TEventPAE>` (or a specific PAE string like `'Spawn'`): `Sound`, `StopSound`
     *   - `CEvent<TEventDE>` (or a specific DE string like `'DisplayEnd'`): `RotateSprite`, `ScreenSound`, `ScreenText`, …
     *
     * Actor struct properties (`picnum`, `x`, `y`, etc.) are **never** available on a
     * standalone `CEvent` — use `CActor` directly, or `OnEvent` inside a `CActor` subclass
     * (which gives `this: CEvent<E> & CActor`).
     */
    export class CEvent<T extends TEvents = TEvents> {
        /** The event's return value. Read to get the value the engine passed in;
         *  write to return a value back (e.g. a replacement tile in EVENT_GETMENUTILE). */
        protected argument: CON_NATIVE_GAMEVAR<'RETURN', number>;

        /**
         * Starts the event declaration
         * @param event - the event that will be defined. See {@link TEvents}
         */
        constructor(event: T)

        // ── PAE-only methods ────────────────────────────────────────────────
        // Available when T extends TEventPAE. THISACTOR is valid; actor struct
        // properties are NOT accessible — use CActor / OnEvent for those.

        /**
         * Plays a sound. Only valid in per-actor events (Game, Spawn, etc.).
         * @param sound_id Sound ID or Sound label.
         * @param global If true, plays globally (audible anywhere).
         * @param once If true, plays at most one instance at a time.
         */
        public Sound(...args: T extends TEventPAE ? [sound_id: number | Sound, global?: boolean, once?: boolean] : never): CON_NATIVE<void>;
        /**
         * Stops a playing sound. Only valid in per-actor events.
         * @param sound_id Sound ID or Sound label.
         */
        public StopSound(...args: T extends TEventPAE ? [sound_id: number | Sound] : never): CON_NATIVE<void>;

        // ── Display-event methods ───────────────────────────────────────────
        // Available when T extends TEventDE (DisplayRooms, DisplayEnd, etc.).

        /**
         * Displays a sprite onto the screen
         * @param x - the X position
         * @param y - the Y position
         * @param scale - the sprite scale (65536 is the sprite's normal size)
         * @param ang - angle
         * @param picnum - the tile number of the sprite
         * @param shade - shade value
         * @param pal - palette value
         * @param orientation - orientation flags
         * @param x0 - the window x0 value
         * @param y0 - the window y0 value
         * @param x1 - the window x1 value. See {@link xDim}
         * @param y1 - the window y1 value. See {@link yDim}
         */
        public RotateSprite(x: number, y: number, scale: number, ang: number, picnum: number, shade: number, pal: number, orientation: number, x0: number, y0: number, x1: number, y1: number): CON_NATIVE<void>;
        /**
         * Full-precision variant of RotateSprite. Accepts normalized screen coordinates,
         * sub-degree angles. Automatically sets ROTATESPRITE_FULL16 in orientation.
         * @param x X position normalized [0.0, 1.0] — 0.0 = left edge, 1.0 = right edge (20971520 FULL16 units).
         * @param y Y position normalized [0.0, 1.0] — 0.0 = top edge, 1.0 = bottom edge (13107200 FULL16 units).
         * @param scale Zoom factor in FP16 (65536 = 1×).
         * @param ang Angle in FP11 BAM (1.0 = 2048 = full circle).
         * @param picnum Tile number.
         * @param shade Shade value.
         * @param pal Palette index.
         * @param orientation Orientation flags (ROTATESPRITE_FULL16 is added automatically).
         * @param x0 Clip rectangle left.
         * @param y0 Clip rectangle top.
         * @param x1 Clip rectangle right.
         * @param y1 Clip rectangle bottom.
         */
        public RotateSpriteF(x: FP16, y: FP16, scale: FP16, ang: FP11, picnum: number, shade: number, pal: number, orientation: number, x0: number, y0: number, x1: number, y1: number): CON_NATIVE<void>;
        /**
         * Displays a sprite onto the screen. An easier method to use.
         * @param pos - the object containg the position of the sprite. See {@link pos2}
         * @param picnum - the tile number of the sprite.
         * @param style - the styling of the sprite. See {@link TStyle}
         */
        public DrawSprite(pos: pos2, picnum: number, style: TStyle): CON_NATIVE<void>;
        /**
         * Plays a sound during display events
         * @param sound - the sound ID to be played
         */
        public ScreenSound(sound: number | Sound): CON_NATIVE<void>;

        /**
         * Set the display aspect ratio. Only valid in EVENT_DISPLAYROOMS.
         * @param daxRange - horizontal range value
         * @param daAspect - aspect ratio value
         */
        public SetAspect(...args: T extends 'DisplayRooms' ? [daxRange: number, daAspect: number] : never): CON_NATIVE<void>;

        /**
         * Writes text to the screen
         * @param picnum the tile number of the font
         * @param x the X position
         * @param y the Y position
         * @param scale the scaling of the text (65536 is the normal size)
         * @param block_ang the angle of the entire text block
         * @param character_ang the angle of each character
         * @param quote the quote number
         * @param shade the shading value
         * @param pal the pallete value
         * @param orientation the orientation flags @see {@link EOrientationFlags}
         * @param alpha the alpha value
         * @param xspace the space between words
         * @param yline the space between lines
         * @param xbetween the X space between characters
         * @param ybetween the Y space between characters
         * @param flags the text flags @see {@link ETextFlags}
         * @param x0 the window x0 value
         * @param y0 the window y0 value
         * @param x1 the window x1 value
         * @param y1 the window y1 value
         */
        public ScreenText(picnum: number, x: number, y: number, scale: number, block_ang: number, character_ang: number, quote: quote, shade: number, pal: number, orientation: number, alpha: number, xspace: number, yline: number, xbetween: number, ybetween: number, flags: number, x0: number, y0: number, x1: number, y1: number): CON_NATIVE<void>;
        /**
         * Full-precision variant of ScreenText. Accepts normalized screen coordinates,
         * sub-degree angles. Automatically sets ROTATESPRITE_FULL16 in orientation.
         * @param picnum Tile number of the font.
         * @param x X position normalized [0.0, 1.0] — 0.0 = left edge, 1.0 = right edge (20971520 FULL16 units).
         * @param y Y position normalized [0.0, 1.0] — 0.0 = top edge, 1.0 = bottom edge (13107200 FULL16 units).
         * @param scale Scale factor in FP16 (65536 = 1×).
         * @param block_ang Angle of the entire text block in FP11 BAM.
         * @param character_ang Angle of each character in FP11 BAM.
         * @param quote Quote number.
         * @param shade Shade value.
         * @param pal Palette index.
         * @param orientation Orientation flags (ROTATESPRITE_FULL16 is added automatically).
         * @param alpha Alpha value.
         * @param xspace Space between words.
         * @param yline Space between lines.
         * @param xbetween X space between characters.
         * @param ybetween Y space between characters.
         * @param flags Text flags.
         * @param x0 Clip rectangle left.
         * @param y0 Clip rectangle top.
         * @param x1 Clip rectangle right.
         * @param y1 Clip rectangle bottom.
         */
        public ScreenTextF(picnum: number, x: FP16, y: FP16, scale: FP16, block_ang: FP11, character_ang: FP11, quote: quote, shade: number, pal: number, orientation: number, alpha: number, xspace: number, yline: number, xbetween: number, ybetween: number, flags: number, x0: number, y0: number, x1: number, y1: number): CON_NATIVE<void>;

        public QuoteDimension(picnum: number, x: number, y: number, scale: number, block_ang: number, character_ang: number, quote: quote, shade: number, pal: number, orientation: number, alpha: number, xspace: number, yline: number, xbetween: number, ybetween: number, flags: number, x0: number, y0: number, x1: number, y1: number): CON_NATIVE<vec2>;

        /**
         * Use append if you want to append this event to the others of the same type
         */
        protected Append(): void | number;
        /**
         * Use this if you want to prepend this event to the other of the same type.
         */
        protected Prepend(): void | number;
    }

    /**
     * Base class for `EVENT_PROCESSINPUT` handlers.
     * Extend this class and implement `Append()` to run code during the engine's
     * input-processing event. Inside `Append()`, access player input via `input.field`
     * (singleton — resolves to `myconnectindex`) or `input[i].field` for a specific slot.
     */
    export class CInput {
        protected Append(): void;
        protected Prepend(): void;
    }

    /**
     * Properties shared by a sector's ceiling and floor surfaces.
     * Accessed via `sectors[i].ceiling.xxx` or `sectors[i].floor.xxx`.
     */
    export interface ISectorBase {
        /** Z height of the surface in world units */
        z: CON_NATIVE<number>;
        /** Tile number used to draw the surface */
        picnum: CON_NATIVE<number>;
        /** Slope value — 0 = flat, positive/negative = angled */
        slope: CON_NATIVE<number>;
        /** Shade level (−128 bright … 127 dark) */
        shade: CON_NATIVE<number>;
        /** Palette lookup index */
        pal: CON_NATIVE<number>;
        /** Texture panning on the X axis */
        xPan: CON_NATIVE<number>;
        /** Texture panning on the Y axis */
        yPan: CON_NATIVE<number>;
        /** Parallax/sky bunch index */
        bunch: CON_NATIVE<number>;
        /** Surface status flags (bit-field) */
        stat: CON_NATIVE<number>;
        /** Target Z height for ceiling/floor movement (interpolation target) */
        zGoal: CON_NATIVE<number>;
        /** Z velocity for moving ceiling/floor surfaces */
        zVel: CON_NATIVE<number>;
    }

    export class CWall {
        public pos: CON_NATIVE<vec2>;
        public point2: CON_NATIVE<number>;

        public blend: CON_NATIVE<number>;

        public nextWall: CON_NATIVE<number>;
        public nextSector: CON_NATIVE<number>;

        public cstat: CON_NATIVE<number>;

        public picnum: CON_NATIVE<number>;
        public overpicnum: CON_NATIVE<number>;

        public shade: CON_NATIVE<number>;
        public pal: CON_NATIVE<number>;

        public texRepeat: CON_NATIVE<vec2>;
        public texPan: CON_NATIVE<vec2>;

        public tags: CON_NATIVE<tag>;

        public extra: CON_NATIVE<number>;
        public ang: CON_NATIVE<number>;

        public wallPoint2: CWall;
        public next: { wall: CWall, sector: ISector };
        public readonly uloTag: CON_NATIVE<number>;
        public readonly uhiTag: CON_NATIVE<number>;
    }

    export class ISector {
        public wallPtr: CON_NATIVE<number>;
        public wallNum: CON_NATIVE<number>;

        public ceiling: CON_NATIVE<ISectorBase>;
        public floor: CON_NATIVE<ISectorBase>;

        public visibility: CON_NATIVE<number>;
        public fogPal: CON_NATIVE<number>;

        public tags: CON_NATIVE<tag>;

        public extra: CON_NATIVE<number>;

        public firstWall: CWall;
        public walls: CWall[];
        public readonly uloTag: CON_NATIVE<number>;
        public readonly uhiTag: CON_NATIVE<number>;
    }

    export const sectors: ISector[];

    /**
     * Weapon flags.
     *
     * @enum {number}
     *
     * @property {number} HOLSTER_CLEARS_CLIP Holster key “refills” magazine by removing excess ammo from the player
     * @property {number} GLOWS Controls glowing effect on SHRINKER weapon’s crystal, no effect on other weapons, probably breaks shotgun if used with that weapon
     * @property {number} AUTOMATIC Resets kickback_pic to 1 instead of 0 when animation ends
     * @property {number} FIREEVERYOTHER Fires projectiles every frame instead of when kickback_pic is equal to WEAPONx_FIREDELAY; also alters burst‐fire behavior so that shots are dispatched once per tic instead of all at once
     * @property {number} FIREEVERYTHIRD Fires when kickback_pic % 3 === 0 (every third frame)
     * @property {number} RANDOMRESTART When used with AUTOMATIC, resets kickback_pic to a random value between 1 and 4 instead of 1 when animation ends
     * @property {number} AMMOPERSHOT Use ammo per shot per burst (like the Devastator)
     * @property {number} BOMB_TRIGGER Is a bomb trigger (Pipebomb Detonator)
     * @property {number} NOVISIBLE Using does NOT cause player to flash the level (clear visibility)
     * @property {number} THROWIT Currently unused
     * @property {number} CHECKATRELOAD Check weapon availability at “reload” time; only affects weapons with WORKSLIKE of TRIPBOMB_WEAPON
     * @property {number} STANDSTILL Stops all player z-axis movement when firing
     * @property {number} SPAWNTYPE2 Spawn Type 2 (Shotgun shells)
     * @property {number} SPAWNTYPE3 Spawn Type 3 (Chaingun shells)
     * @property {number} SEMIAUTO Semi‐automatic (cancel button press after each shot)
     * @property {number} RELOAD_TIMING Alternate formula for reload sound timing, generally used for pistol
     * @property {number} RESET Resets kickback_pic to 1 instead of 0 at end of firing animation if fire is held
     */
    export enum EWeaponFlags {
        HOLSTER_CLEARS_CLIP = 1,
        GLOWS = 2,
        AUTOMATIC = 4,
        FIREEVERYOTHER = 8,
        FIREEVERYTHIRD = 16,
        RANDOMRESTART = 32,
        AMMOPERSHOT = 64,
        BOMB_TRIGGER = 128,
        NOVISIBLE = 256,
        THROWIT = 512,
        CHECKATRELOAD = 1024,
        STANDSTILL = 2048,
        SPAWNTYPE2 = 4096,
        SPAWNTYPE3 = 8192,
        SEMIAUTO = 16384,
        RELOAD_TIMING = 32768,
        RESET = 65536,
    }

    /**
     * Interface for the Mighty Foot weapon (weapon 00).
     * 
     * Use this interface to define the properties and behaviors of the weapon in the game.
     * Available properties:
     * @property {CON_NATIVE_GAMEVAR} flags - The flags for the weapon (does not control the projectile)
     * @property {CON_NATIVE_GAMEVAR} clip - It's the amount of ammo that can be fired before there is a reloading animation and pause.
     * @property {CON_NATIVE_GAMEVAR} reload - Defines the number of frames displayed in the weapon's reload sequence
     * @property {CON_NATIVE_GAMEVAR} fireDelay - Defines what frame the weapon will fire its projectile on.
     * @property {CON_NATIVE_GAMEVAR} holdDelay - The number of animation frames between shooting and reloading.
     * @property {CON_NATIVE_GAMEVAR} totalTime - Defines the total number of frames a weapon uses in its firing sequence.
     * @property {CON_NATIVE_GAMEVAR} flashColor - The flash color of the weapon.
     * @property {CON_NATIVE_GAMEVAR} shoots - This is the tilenum of the projectile.
     * @property {CON_NATIVE_GAMEVAR} shotsPerBurst - Defines the amount of projectiles that will fire when the weapon reaches its firing frame.
     * @property {CON_NATIVE_GAMEVAR} spawn - This defines what the weapon spawns when the spawnTime is reached.
     * @property {CON_NATIVE_GAMEVAR} spawnTime - Defines what frame the item specified by spawn will spawn on.
     * @property {CON_NATIVE_GAMEVAR} reloadSound1 - If RELOAD_TIMING is enabled, this is the first sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} reloadSound2 - If RELOAD_TIMING is enabled, this is the second sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} selectSound - The sound played when a weapon is selected.
     * @property {CON_NATIVE_GAMEVAR} fireSound - Plays the corresponding sound when the weapon counter reaches the number specified by fireDelay.
     * @property {CON_NATIVE_GAMEVAR} initialSound - Defines the sound that will play when the player starts to fire the weapon.
     * @property {CON_NATIVE_GAMEVAR} sound2Sound - This is the weapon's second sound.
     * @property {CON_NATIVE_GAMEVAR} sound2Time - If the weapon has a second shooting sound defined, this is the frame number for the second sound to start.
     */
    export interface IWeapon00 {
        /** 
         * The flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        flags: CON_NATIVE_GAMEVAR<'WEAPON0_FLAGS', number>;

        /** 
         * It's the amount of ammo that can be fired before there is a reloading animation and pause.
         * If you want to disable the reloading, set {@link clip} to 0. 
         * */
        clip: CON_NATIVE_GAMEVAR<'WEAPON0_CLIP', number>;
        /** 
         * Defines the number of frames displayed in the weapon's reload sequence,
         * in a similar vein to {@link totalTime}. If {@link clip} is zero, this sequence takes place after every shot.
         * If non-zero, it takes place when the remainder of the weapon's current ammo divided by {@link clip} is zero.
         * The {@link hudCounter} values increase to a weapon's {@link totalTime} plus its {@link reload}. */
        reload: CON_NATIVE_GAMEVAR<'WEAPON0_RELOAD', number>;

        /** Defines what frame the weapon will fire it's projectile on. */
        fireDelay: CON_NATIVE_GAMEVAR<'WEAPON0_FIREDELAY', number>;
        /**
         * The number of animation frames between shooting and reloading. 
         * @see **Note**: If {@link flags} has {@link EWeaponFlags.RESET} set on the weapon
         * and {@link hudCounter} is greater than {@link totalTime} - holdDelay,
         * then {@link hudCounter} is set to either 1 or 0 depending on whether the fire key is still held.
         */
        holdDelay: CON_NATIVE_GAMEVAR<'WEAPON0_HOLDDELAY', number>;
        /** Defines the total number of frames a weapon uses in its firing sequence. */
        totalTime: CON_NATIVE_GAMEVAR<'WEAPON0_TOTALTIME', number>;

        flashColor: CON_NATIVE_GAMEVAR<'WEAPON0_FLASHCOLOR', number>;

        /** This is the tilenum of the projectile */
        shoots: CON_NATIVE_GAMEVAR<'WEAPON0_SHOOTS', number>;
        /** 
         * Defines the amount of projectiles (which itself is defined by {@link shoots})
         * that will fire when the weapon reaches it's firing frame.
         */
        shotsPerBurst: CON_NATIVE_GAMEVAR<'WEAPON0_SHOTSPERBURST', number>;

        /**
         * This defines what the weapon spawns when the {@link spawnTime} is reached.
         * Used in the default weapons to spawn empty shells.
         * To spawn nothing, set to 0.
         */
        spawn: CON_NATIVE_GAMEVAR<'WEAPON0_SPAWN', number>;
        /**
         * Defines what frame the item specified by {@link spawn} will spawn on.
         */
        spawnTime: CON_NATIVE_GAMEVAR<'WEAPON0_SPAWNTIME', number>;

        /**
         * If {@link EWeaponFlags.RELOAD_TIMING} is enabled in the {@link flags} bitfield,
         * reloadSound1 is the first sound to be played in the weapon's reload sequence. {@link reloadSound2} is the second.
         * All weapons have this value set to **EJECT_CLIP** by default but only
         * WEAPON 1 (the pistol) utilizes it.
         */
        reloadSound1: CON_NATIVE_GAMEVAR<'WEAPON0_RELOADSOUND1', number>;
        /**
         * If {@link EWeaponFlags.RELOAD_TIMING} is enabled in the {@link flags} bitfield,
         * reloadSound2 is the second sound to be played in the weapon's reload sequence. {@link reloadSound1} is the first.
         * All weapons have this value set to **INSERT_CLIP** by default but only
         * WEAPON 1 (the pistol) utilizes it.
         */
        reloadSound2: CON_NATIVE_GAMEVAR<'WEAPON0_RELOADSOUND2', number>;
        /** The sound played when a weapon is selected. */
        selectSound: CON_NATIVE_GAMEVAR<'WEAPON0_SELECTSOUND', number>;
        /** 
         * Plays the corresponding sound when the {@link hudCounter} reaches
         * the number specified by {@link fireDelay}
         */
        fireSound: CON_NATIVE_GAMEVAR<'WEAPON0_FIRESOUND', number>;
        /**
         * Defines the sound that will play when the player starts to fire the weapon
         * **(NOT the sound that will play when the weapon actually fires its projectile**
         * that is controlled by {@link fireSound})
         * @see {@link fireSound}
         */
        initialSound: CON_NATIVE_GAMEVAR<'WEAPON0_INITIALSOUND', number>;
        /**
         * This is the weapon's second sound.
         * It starts on the frame number defined with {@link sound2Time}.
         */
        sound2Sound: CON_NATIVE_GAMEVAR<'WEAPON0_SOUND2SOUND', number>;
        /**
         * If the weapon has a second shooting sound defined in {@link sound2Sound} like the shotgun,
         * this is the frame number for the second sound to start.
         */
        sound2Time: CON_NATIVE_GAMEVAR<'WEAPON0_SOUND2TIME', number>;
    }

    export const weapon00, wpMightFoot: CON_NATIVE_OBJECT<IWeapon00>;

    /**
     * Interface for the Pistol weapon (weapon 01).
     * 
     * Use this interface to define the properties and behaviors of the weapon in the game.
     * Available properties:
     * @property {CON_NATIVE_GAMEVAR} flags - The flags for the weapon (does not control the projectile)
     * @property {CON_NATIVE_GAMEVAR} clip - It's the amount of ammo that can be fired before there is a reloading animation and pause.
     * @property {CON_NATIVE_GAMEVAR} reload - Defines the number of frames displayed in the weapon's reload sequence
     * @property {CON_NATIVE_GAMEVAR} fireDelay - Defines what frame the weapon will fire its projectile on.
     * @property {CON_NATIVE_GAMEVAR} holdDelay - The number of animation frames between shooting and reloading.
     * @property {CON_NATIVE_GAMEVAR} totalTime - Defines the total number of frames a weapon uses in its firing sequence.
     * @property {CON_NATIVE_GAMEVAR} flashColor - The flash color of the weapon.
     * @property {CON_NATIVE_GAMEVAR} shoots - This is the tilenum of the projectile.
     * @property {CON_NATIVE_GAMEVAR} shotsPerBurst - Defines the amount of projectiles that will fire when the weapon reaches its firing frame.
     * @property {CON_NATIVE_GAMEVAR} spawn - This defines what the weapon spawns when the spawnTime is reached.
     * @property {CON_NATIVE_GAMEVAR} spawnTime - Defines what frame the item specified by spawn will spawn on.
     * @property {CON_NATIVE_GAMEVAR} reloadSound1 - If RELOAD_TIMING is enabled, this is the first sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} reloadSound2 - If RELOAD_TIMING is enabled, this is the second sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} selectSound - The sound played when a weapon is selected.
     * @property {CON_NATIVE_GAMEVAR} fireSound - Plays the corresponding sound when the weapon counter reaches the number specified by fireDelay.
     * @property {CON_NATIVE_GAMEVAR} initialSound - Defines the sound that will play when the player starts to fire the weapon.
     * @property {CON_NATIVE_GAMEVAR} sound2Sound - This is the weapon's second sound.
     * @property {CON_NATIVE_GAMEVAR} sound2Time - If the weapon has a second shooting sound defined, this is the frame number for the second sound to start.
     */
    export interface IWeapon01 {
        /** 
         * The flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        flags: CON_NATIVE_GAMEVAR<'WEAPON1_FLAGS', number>;

        /** 
         * It's the amount of ammo that can be fired before there is a reloading animation and pause.
         * If you want to disable the reloading, set {@link clip} to 0. 
         * */
        clip: CON_NATIVE_GAMEVAR<'WEAPON1_CLIP', number>;
        /** 
         * Defines the number of frames displayed in the weapon's reload sequence,
         * in a similar vein to {@link totalTime}. If {@link clip} is zero, this sequence takes place after every shot.
         * If non-zero, it takes place when the remainder of the weapon's current ammo divided by {@link clip} is zero.
         * The {@link hudCounter} values increase to a weapon's {@link totalTime} plus its {@link reload}. */
        reload: CON_NATIVE_GAMEVAR<'WEAPON1_RELOAD', number>;

        /** Defines what frame the weapon will fire it's projectile on. */
        fireDelay: CON_NATIVE_GAMEVAR<'WEAPON1_FIREDELAY', number>;
        /**
         * The number of animation frames between shooting and reloading. 
         * @see **Note**: If {@link flags} has {@link EWeaponFlags.RESET} set on the weapon
         * and {@link hudCounter} is greater than {@link totalTime} - holdDelay,
         * then {@link hudCounter} is set to either 1 or 0 depending on whether the fire key is still held.
         */
        holdDelay: CON_NATIVE_GAMEVAR<'WEAPON1_HOLDDELAY', number>;
        /** Defines the total number of frames a weapon uses in its firing sequence. */
        totalTime: CON_NATIVE_GAMEVAR<'WEAPON1_TOTALTIME', number>;

        flashColor: CON_NATIVE_GAMEVAR<'WEAPON1_FLASHCOLOR', number>;

        /** This is the tilenum of the projectile */
        shoots: CON_NATIVE_GAMEVAR<'WEAPON1_SHOOTS', number>;
        /** 
         * Defines the amount of projectiles (which itself is defined by {@link shoots})
         * that will fire when the weapon reaches it's firing frame.
         */
        shotsPerBurst: CON_NATIVE_GAMEVAR<'WEAPON1_SHOTSPERBURST', number>;

        /**
         * This defines what the weapon spawns when the {@link spawnTime} is reached.
         * Used in the default weapons to spawn empty shells.
         * To spawn nothing, set to 0.
         */
        spawn: CON_NATIVE_GAMEVAR<'WEAPON1_SPAWN', number>;
        /**
         * Defines what frame the item specified by {@link spawn} will spawn on.
         */
        spawnTime: CON_NATIVE_GAMEVAR<'WEAPON1_SPAWNTIME', number>;

        /**
         * If {@link EWeaponFlags.RELOAD_TIMING} is enabled in the {@link flags} bitfield,
         * reloadSound1 is the first sound to be played in the weapon's reload sequence. {@link reloadSound2} is the second.
         * All weapons have this value set to **EJECT_CLIP** by default but only
         * WEAPON 1 (the pistol) utilizes it.
         */
        reloadSound1: CON_NATIVE_GAMEVAR<'WEAPON1_RELOADSOUND1', number>;
        /**
         * If {@link EWeaponFlags.RELOAD_TIMING} is enabled in the {@link flags} bitfield,
         * reloadSound2 is the second sound to be played in the weapon's reload sequence. {@link reloadSound1} is the first.
         * All weapons have this value set to **INSERT_CLIP** by default but only
         * WEAPON 1 (the pistol) utilizes it.
         */
        reloadSound2: CON_NATIVE_GAMEVAR<'WEAPON1_RELOADSOUND2', number>;
        /** The sound played when a weapon is selected. */
        selectSound: CON_NATIVE_GAMEVAR<'WEAPON1_SELECTSOUND', number>;
        /** 
         * Plays the corresponding sound when the {@link hudCounter} reaches
         * the number specified by {@link fireDelay}
         */
        fireSound: CON_NATIVE_GAMEVAR<'WEAPON1_FIRESOUND', number>;
        /**
         * Defines the sound that will play when the player starts to fire the weapon
         * **(NOT the sound that will play when the weapon actually fires its projectile**
         * that is controlled by {@link fireSound})
         * @see {@link fireSound}
         */
        initialSound: CON_NATIVE_GAMEVAR<'WEAPON1_INITIALSOUND', number>;
        /**
         * This is the weapon's second sound.
         * It starts on the frame number defined with {@link sound2Time}.
         */
        sound2Sound: CON_NATIVE_GAMEVAR<'WEAPON1_SOUND2SOUND', number>;
        /**
         * If the weapon has a second shooting sound defined in {@link sound2Sound} like the shotgun,
         * this is the frame number for the second sound to start.
         */
        sound2Time: CON_NATIVE_GAMEVAR<'WEAPON1_SOUND2TIME', number>;
    }


    export const weapon01, wpPistol: CON_NATIVE_OBJECT<IWeapon01>;

    /**
     * Interface for the Shotgun weapon (weapon 02).
     * @see {@link weapon02}
     * Use this interface to define the properties and behaviors of the weapon in the game.
     * Available properties:
     * @property {CON_NATIVE_GAMEVAR} flags - The flags for the weapon (does not control the projectile)
     * @property {CON_NATIVE_GAMEVAR} clip - It's the amount of ammo that can be fired before there is a reloading animation and pause.
     * @property {CON_NATIVE_GAMEVAR} reload - Defines the number of frames displayed in the weapon's reload sequence
     * @property {CON_NATIVE_GAMEVAR} fireDelay - Defines what frame the weapon will fire its projectile on.
     * @property {CON_NATIVE_GAMEVAR} holdDelay - The number of animation frames between shooting and reloading.
     * @property {CON_NATIVE_GAMEVAR} totalTime - Defines the total number of frames a weapon uses in its firing sequence.
     * @property {CON_NATIVE_GAMEVAR} flashColor - The flash color of the weapon.
     * @property {CON_NATIVE_GAMEVAR} shoots - This is the tilenum of the projectile.
     * @property {CON_NATIVE_GAMEVAR} shotsPerBurst - Defines the amount of projectiles that will fire when the weapon reaches its firing frame.
     * @property {CON_NATIVE_GAMEVAR} spawn - This defines what the weapon spawns when the spawnTime is reached.
     * @property {CON_NATIVE_GAMEVAR} spawnTime - Defines what frame the item specified by spawn will spawn on.
     * @property {CON_NATIVE_GAMEVAR} reloadSound1 - If RELOAD_TIMING is enabled, this is the first sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} reloadSound2 - If RELOAD_TIMING is enabled, this is the second sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} selectSound - The sound played when a weapon is selected.
     * @property {CON_NATIVE_GAMEVAR} fireSound - Plays the corresponding sound when the weapon counter reaches the number specified by fireDelay.
     * @property {CON_NATIVE_GAMEVAR} initialSound - Defines the sound that will play when the player starts to fire the weapon
     * @property {CON_NATIVE_GAMEVAR} sound2Sound - This is the weapon's second sound.
     * @property {CON_NATIVE_GAMEVAR} sound2Time - If the weapon has a second shooting sound defined, this is the frame number for the second sound to start.
     */
    export interface IWeapon02 {
        /**
         * Flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        flags: CON_NATIVE_GAMEVAR<'WEAPON2_FLAGS', number>;
        clip: CON_NATIVE_GAMEVAR<'WEAPON2_CLIP', number>;
        reload: CON_NATIVE_GAMEVAR<'WEAPON2_RELOAD', number>;
        fireDelay: CON_NATIVE_GAMEVAR<'WEAPON2_FIREDELAY', number>;
        holdDelay: CON_NATIVE_GAMEVAR<'WEAPON2_HOLDDELAY', number>;
        totalTime: CON_NATIVE_GAMEVAR<'WEAPON2_TOTALTIME', number>;
        flashColor: CON_NATIVE_GAMEVAR<'WEAPON2_FLASHCOLOR', number>;
        shoots: CON_NATIVE_GAMEVAR<'WEAPON2_SHOOTS', number>;
        shotsPerBurst: CON_NATIVE_GAMEVAR<'WEAPON2_SHOTSPERBURST', number>;
        spawn: CON_NATIVE_GAMEVAR<'WEAPON2_SPAWN', number>;
        spawnTime: CON_NATIVE_GAMEVAR<'WEAPON2_SPAWNTIME', number>;
        reloadSound1: CON_NATIVE_GAMEVAR<'WEAPON2_RELOADSOUND1', number>;
        reloadSound2: CON_NATIVE_GAMEVAR<'WEAPON2_RELOADSOUND2', number>;
        selectSound: CON_NATIVE_GAMEVAR<'WEAPON2_SELECTSOUND', number>;
        fireSound: CON_NATIVE_GAMEVAR<'WEAPON2_FIRESOUND', number>;
        initialSound: CON_NATIVE_GAMEVAR<'WEAPON2_INITIALSOUND', number>;
        sound2Sound: CON_NATIVE_GAMEVAR<'WEAPON2_SOUND2SOUND', number>;
        sound2Time: CON_NATIVE_GAMEVAR<'WEAPON2_SOUND2TIME', number>;
    }
    export const weapon02, wpShotgun: CON_NATIVE_OBJECT<IWeapon02>;

    /**
     * Interface for the Chaingun weapon (weapon 03).
     * @see {@link weapon03}
     * Use this interface to define the properties and behaviors of the weapon in the game.
     * Available properties:
     * @property {CON_NATIVE_GAMEVAR} flags - The flags for the weapon (does not control the projectile)
     * @property {CON_NATIVE_GAMEVAR} clip - It's the amount of ammo that can be fired before there is a reloading animation and pause.
     * @property {CON_NATIVE_GAMEVAR} reload - Defines the number of frames displayed in the weapon's reload sequence
     * @property {CON_NATIVE_GAMEVAR} fireDelay - Defines what frame the weapon will fire its projectile on.
     * @property {CON_NATIVE_GAMEVAR} holdDelay - The number of animation frames between shooting and reloading.
     * @property {CON_NATIVE_GAMEVAR} totalTime - Defines the total number of frames a weapon uses in its firing sequence.
     * @property {CON_NATIVE_GAMEVAR} flashColor - The flash color of the weapon.
     * @property {CON_NATIVE_GAMEVAR} shoots - This is the tilenum of the projectile.
     * @property {CON_NATIVE_GAMEVAR} shotsPerBurst - Defines the amount of projectiles that will fire when the weapon reaches its firing frame.
     * @property {CON_NATIVE_GAMEVAR} spawn - This defines what the weapon spawns when the spawnTime is reached.
     * @property {CON_NATIVE_GAMEVAR} spawnTime - Defines what frame the item specified by spawn will spawn on.
     * @property {CON_NATIVE_GAMEVAR} reloadSound1 - If RELOAD_TIMING is enabled, this is the first sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} reloadSound2 - If RELOAD_TIMING is enabled, this is the second sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} selectSound - The sound played when a weapon is selected.
     * @property {CON_NATIVE_GAMEVAR} fireSound - Plays the corresponding sound when the weapon counter reaches the number specified by fireDelay.
     * @property {CON_NATIVE_GAMEVAR} initialSound - Defines the sound that will play when the player starts to fire the weapon.
     * @property {CON_NATIVE_GAMEVAR} sound2Sound - This is the weapon's second sound.
     * @property {CON_NATIVE_GAMEVAR} sound2Time - If the weapon has a second shooting sound defined, this is the frame number for the second sound to start.
     */
    export interface IWeapon03 {
        /**
         * Flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        flags: CON_NATIVE_GAMEVAR<'WEAPON3_FLAGS', number>;
        clip: CON_NATIVE_GAMEVAR<'WEAPON3_CLIP', number>;
        reload: CON_NATIVE_GAMEVAR<'WEAPON3_RELOAD', number>;
        fireDelay: CON_NATIVE_GAMEVAR<'WEAPON3_FIREDELAY', number>;
        holdDelay: CON_NATIVE_GAMEVAR<'WEAPON3_HOLDDELAY', number>;
        totalTime: CON_NATIVE_GAMEVAR<'WEAPON3_TOTALTIME', number>;
        flashColor: CON_NATIVE_GAMEVAR<'WEAPON3_FLASHCOLOR', number>;
        shoots: CON_NATIVE_GAMEVAR<'WEAPON3_SHOOTS', number>;
        shotsPerBurst: CON_NATIVE_GAMEVAR<'WEAPON3_SHOTSPERBURST', number>;
        spawn: CON_NATIVE_GAMEVAR<'WEAPON3_SPAWN', number>;
        spawnTime: CON_NATIVE_GAMEVAR<'WEAPON3_SPAWNTIME', number>;
        reloadSound1: CON_NATIVE_GAMEVAR<'WEAPON3_RELOADSOUND1', number>;
        reloadSound2: CON_NATIVE_GAMEVAR<'WEAPON3_RELOADSOUND2', number>;
        selectSound: CON_NATIVE_GAMEVAR<'WEAPON3_SELECTSOUND', number>;
        fireSound: CON_NATIVE_GAMEVAR<'WEAPON3_FIRESOUND', number>;
        initialSound: CON_NATIVE_GAMEVAR<'WEAPON3_INITIALSOUND', number>;
        sound2Sound: CON_NATIVE_GAMEVAR<'WEAPON3_SOUND2SOUND', number>;
        sound2Time: CON_NATIVE_GAMEVAR<'WEAPON3_SOUND2TIME', number>;
    }
    export const weapon03, wpChaingun: CON_NATIVE_OBJECT<IWeapon03>;

    /**
     * Interface for the RPG weapon (weapon 04).
     * @see {@link weapon04}
     * Use this interface to define the properties and behaviors of the weapon in the game.
     * Available properties:
     * @property {CON_NATIVE_GAMEVAR} flags - The flags for the weapon (does not control the projectile)
     * @property {CON_NATIVE_GAMEVAR} clip - It's the amount of ammo that can be fired before there is a reloading animation and pause.
     * @property {CON_NATIVE_GAMEVAR} reload - Defines the number of frames displayed in the weapon's reload sequence
     * @property {CON_NATIVE_GAMEVAR} fireDelay - Defines what frame the weapon will fire its projectile on.
     * @property {CON_NATIVE_GAMEVAR} holdDelay - The number of animation frames between shooting and reloading.
     * @property {CON_NATIVE_GAMEVAR} totalTime - Defines the total number of frames a weapon uses in its firing sequence.
     * @property {CON_NATIVE_GAMEVAR} flashColor - The flash color of the weapon.
     * @property {CON_NATIVE_GAMEVAR} shoots - This is the tilenum of the projectile.
     * @property {CON_NATIVE_GAMEVAR} shotsPerBurst - Defines the amount of projectiles that will fire when the weapon reaches its firing frame.
     * @property {CON_NATIVE_GAMEVAR} spawn - This defines what the weapon spawns when the spawnTime is reached.
     * @property {CON_NATIVE_GAMEVAR} spawnTime - Defines what frame the item specified by spawn will spawn on.
     * @property {CON_NATIVE_GAMEVAR} reloadSound1 - If RELOAD_TIMING is enabled, this is the first sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} reloadSound2 - If RELOAD_TIMING is enabled, this is the second sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} selectSound - The sound played when a weapon is selected.
     * @property {CON_NATIVE_GAMEVAR} fireSound - Plays the corresponding sound when the weapon counter reaches the number specified by fireDelay.
     * @property {CON_NATIVE_GAMEVAR} initialSound - Defines the sound that will play when the player starts to fire the weapon.
     * @property {CON_NATIVE_GAMEVAR} sound2Sound - This is the weapon's second sound.
     * @property {CON_NATIVE_GAMEVAR} sound2Time - If the weapon has a second shooting sound defined, this is the frame number for the second sound to start.
     */
    export interface IWeapon04 {
        /**
         * Flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        flags: CON_NATIVE_GAMEVAR<'WEAPON4_FLAGS', number>;
        clip: CON_NATIVE_GAMEVAR<'WEAPON4_CLIP', number>;
        reload: CON_NATIVE_GAMEVAR<'WEAPON4_RELOAD', number>;
        fireDelay: CON_NATIVE_GAMEVAR<'WEAPON4_FIREDELAY', number>;
        holdDelay: CON_NATIVE_GAMEVAR<'WEAPON4_HOLDDELAY', number>;
        totalTime: CON_NATIVE_GAMEVAR<'WEAPON4_TOTALTIME', number>;
        flashColor: CON_NATIVE_GAMEVAR<'WEAPON4_FLASHCOLOR', number>;
        shoots: CON_NATIVE_GAMEVAR<'WEAPON4_SHOOTS', number>;
        shotsPerBurst: CON_NATIVE_GAMEVAR<'WEAPON4_SHOTSPERBURST', number>;
        spawn: CON_NATIVE_GAMEVAR<'WEAPON4_SPAWN', number>;
        spawnTime: CON_NATIVE_GAMEVAR<'WEAPON4_SPAWNTIME', number>;
        reloadSound1: CON_NATIVE_GAMEVAR<'WEAPON4_RELOADSOUND1', number>;
        reloadSound2: CON_NATIVE_GAMEVAR<'WEAPON4_RELOADSOUND2', number>;
        selectSound: CON_NATIVE_GAMEVAR<'WEAPON4_SELECTSOUND', number>;
        fireSound: CON_NATIVE_GAMEVAR<'WEAPON4_FIRESOUND', number>;
        initialSound: CON_NATIVE_GAMEVAR<'WEAPON4_INITIALSOUND', number>;
        sound2Sound: CON_NATIVE_GAMEVAR<'WEAPON4_SOUND2SOUND', number>;
        sound2Time: CON_NATIVE_GAMEVAR<'WEAPON4_SOUND2TIME', number>;
    }
    export const weapon04, wpRPG: CON_NATIVE_OBJECT<IWeapon04>;

    /**
     * Interface for the Pipebomb weapon (weapon 05).
     * @see {@link weapon05}
     * Use this interface to define the properties and behaviors of the weapon in the game.
     * Available properties:
     * @property {CON_NATIVE_GAMEVAR} flags - The flags for the weapon (does not control the projectile)
     * @property {CON_NATIVE_GAMEVAR} clip - It's the amount of ammo that can be fired before there is a reloading animation and pause.
     * @property {CON_NATIVE_GAMEVAR} reload - Defines the number of frames displayed in the weapon's reload sequence
     * @property {CON_NATIVE_GAMEVAR} fireDelay - Defines what frame the weapon will fire its projectile on.
     * @property {CON_NATIVE_GAMEVAR} holdDelay - The number of animation frames between shooting and reloading.
     * @property {CON_NATIVE_GAMEVAR} totalTime - Defines the total number of frames a weapon uses in its firing sequence.
     * @property {CON_NATIVE_GAMEVAR} flashColor - The flash color of the weapon.
     * @property {CON_NATIVE_GAMEVAR} shoots - This is the tilenum of the projectile.
     * @property {CON_NATIVE_GAMEVAR} shotsPerBurst - Defines the amount of projectiles that will fire when the weapon reaches its firing frame.
     * @property {CON_NATIVE_GAMEVAR} spawn - This defines what the weapon spawns when the spawnTime is reached.
     * @property {CON_NATIVE_GAMEVAR} spawnTime - Defines what frame the item specified by spawn will spawn on.
     * @property {CON_NATIVE_GAMEVAR} reloadSound1 - If RELOAD_TIMING is enabled, this is the first sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} reloadSound2 - If RELOAD_TIMING is enabled, this is the second sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} selectSound - The sound played when a weapon is selected.
     * @property {CON_NATIVE_GAMEVAR} fireSound - Plays the corresponding sound when the weapon counter reaches the number specified by fireDelay.
     * @property {CON_NATIVE_GAMEVAR} initialSound - Defines the sound that will play when the player starts to fire the weapon.
     * @property {CON_NATIVE_GAMEVAR} sound2Sound - This is the weapon's second sound.
     * @property {CON_NATIVE_GAMEVAR} sound2Time - If the weapon has a second shooting sound defined, this is the frame number for the second sound to start.
     */
    export interface IWeapon05 {
        /**
         * Flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        flags: CON_NATIVE_GAMEVAR<'WEAPON5_FLAGS', number>;
        clip: CON_NATIVE_GAMEVAR<'WEAPON5_CLIP', number>;
        reload: CON_NATIVE_GAMEVAR<'WEAPON5_RELOAD', number>;
        fireDelay: CON_NATIVE_GAMEVAR<'WEAPON5_FIREDELAY', number>;
        holdDelay: CON_NATIVE_GAMEVAR<'WEAPON5_HOLDDELAY', number>;
        totalTime: CON_NATIVE_GAMEVAR<'WEAPON5_TOTALTIME', number>;
        flashColor: CON_NATIVE_GAMEVAR<'WEAPON5_FLASHCOLOR', number>;
        shoots: CON_NATIVE_GAMEVAR<'WEAPON5_SHOOTS', number>;
        shotsPerBurst: CON_NATIVE_GAMEVAR<'WEAPON5_SHOTSPERBURST', number>;
        spawn: CON_NATIVE_GAMEVAR<'WEAPON5_SPAWN', number>;
        spawnTime: CON_NATIVE_GAMEVAR<'WEAPON5_SPAWNTIME', number>;
        reloadSound1: CON_NATIVE_GAMEVAR<'WEAPON5_RELOADSOUND1', number>;
        reloadSound2: CON_NATIVE_GAMEVAR<'WEAPON5_RELOADSOUND2', number>;
        selectSound: CON_NATIVE_GAMEVAR<'WEAPON5_SELECTSOUND', number>;
        fireSound: CON_NATIVE_GAMEVAR<'WEAPON5_FIRESOUND', number>;
        initialSound: CON_NATIVE_GAMEVAR<'WEAPON5_INITIALSOUND', number>;
        sound2Sound: CON_NATIVE_GAMEVAR<'WEAPON5_SOUND2SOUND', number>;
        sound2Time: CON_NATIVE_GAMEVAR<'WEAPON5_SOUND2TIME', number>;
    }
    export const weapon05, wpPipebomb: CON_NATIVE_OBJECT<IWeapon05>;

    /**
     * Interface for the Shrinker weapon (weapon 06).
     * @see {@link weapon06}
     * Use this interface to define the properties and behaviors of the weapon in the game.
     * Available properties:
     * @property {CON_NATIVE_GAMEVAR} flags - The flags for the weapon (does not control the projectile)
     * @property {CON_NATIVE_GAMEVAR} clip - It's the amount of ammo that can be fired before there is a reloading animation and pause.
     * @property {CON_NATIVE_GAMEVAR} reload - Defines the number of frames displayed in the weapon's reload sequence
     * @property {CON_NATIVE_GAMEVAR} fireDelay - Defines what frame the weapon will fire its projectile on.
     * @property {CON_NATIVE_GAMEVAR} holdDelay - The number of animation frames between shooting and reloading.
     * @property {CON_NATIVE_GAMEVAR} totalTime - Defines the total number of frames a weapon uses in its firing sequence.
     * @property {CON_NATIVE_GAMEVAR} flashColor - The flash color of the weapon.
     * @property {CON_NATIVE_GAMEVAR} shoots - This is the tilenum of the projectile.
     * @property {CON_NATIVE_GAMEVAR} shotsPerBurst - Defines the amount of projectiles that will fire when the weapon reaches its firing frame.
     * @property {CON_NATIVE_GAMEVAR} spawn - This defines what the weapon spawns when the spawnTime is reached.
     * @property {CON_NATIVE_GAMEVAR} spawnTime - Defines what frame the item specified by spawn will spawn on.
     * @property {CON_NATIVE_GAMEVAR} reloadSound1 - If RELOAD_TIMING is enabled, this is the first sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} reloadSound2 - If RELOAD_TIMING is enabled, this is the second sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} selectSound - The sound played when a weapon is selected.
     * @property {CON_NATIVE_GAMEVAR} fireSound - Plays the corresponding sound when the weapon counter reaches the number specified by fireDelay.
     * @property {CON_NATIVE_GAMEVAR} initialSound - Defines the sound that will play when the player starts to fire the weapon.
     * @property {CON_NATIVE_GAMEVAR} sound2Sound - This is the weapon's second sound.
     * @property {CON_NATIVE_GAMEVAR} sound2Time - If the weapon has a second shooting sound defined, this is the frame number for the second sound to start.
     */
    export interface IWeapon06 {
        /**
         * Flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        flags: CON_NATIVE_GAMEVAR<'WEAPON6_FLAGS', number>;
        clip: CON_NATIVE_GAMEVAR<'WEAPON6_CLIP', number>;
        reload: CON_NATIVE_GAMEVAR<'WEAPON6_RELOAD', number>;
        fireDelay: CON_NATIVE_GAMEVAR<'WEAPON6_FIREDELAY', number>;
        holdDelay: CON_NATIVE_GAMEVAR<'WEAPON6_HOLDDELAY', number>;
        totalTime: CON_NATIVE_GAMEVAR<'WEAPON6_TOTALTIME', number>;
        flashColor: CON_NATIVE_GAMEVAR<'WEAPON6_FLASHCOLOR', number>;
        shoots: CON_NATIVE_GAMEVAR<'WEAPON6_SHOOTS', number>;
        shotsPerBurst: CON_NATIVE_GAMEVAR<'WEAPON6_SHOTSPERBURST', number>;
        spawn: CON_NATIVE_GAMEVAR<'WEAPON6_SPAWN', number>;
        spawnTime: CON_NATIVE_GAMEVAR<'WEAPON6_SPAWNTIME', number>;
        reloadSound1: CON_NATIVE_GAMEVAR<'WEAPON6_RELOADSOUND1', number>;
        reloadSound2: CON_NATIVE_GAMEVAR<'WEAPON6_RELOADSOUND2', number>;
        selectSound: CON_NATIVE_GAMEVAR<'WEAPON6_SELECTSOUND', number>;
        fireSound: CON_NATIVE_GAMEVAR<'WEAPON6_FIRESOUND', number>;
        initialSound: CON_NATIVE_GAMEVAR<'WEAPON6_INITIALSOUND', number>;
        sound2Sound: CON_NATIVE_GAMEVAR<'WEAPON6_SOUND2SOUND', number>;
        sound2Time: CON_NATIVE_GAMEVAR<'WEAPON6_SOUND2TIME', number>;
    }
    export const weapon06, wpShrinker: CON_NATIVE_OBJECT<IWeapon06>;

    /**
     * Interface for the Devastator weapon (weapon 07).
     * @see {@link weapon07}
     * Use this interface to define the properties and behaviors of the weapon in the game.
     * Available properties:
     * @property {CON_NATIVE_GAMEVAR} flags - The flags for the weapon (does not control the projectile)
     * @property {CON_NATIVE_GAMEVAR} clip - It's the amount of ammo that can be fired before there is a reloading animation and pause.
     * @property {CON_NATIVE_GAMEVAR} reload - Defines the number of frames displayed in the weapon's reload sequence
     * @property {CON_NATIVE_GAMEVAR} fireDelay - Defines what frame the weapon will fire its projectile on.
     * @property {CON_NATIVE_GAMEVAR} holdDelay - The number of animation frames between shooting and reloading.
     * @property {CON_NATIVE_GAMEVAR} totalTime - Defines the total number of frames a weapon uses in its firing sequence.
     * @property {CON_NATIVE_GAMEVAR} flashColor - The flash color of the weapon.
     * @property {CON_NATIVE_GAMEVAR} shoots - This is the tilenum of the projectile.
     * @property {CON_NATIVE_GAMEVAR} shotsPerBurst - Defines the amount of projectiles that will fire when the weapon reaches its firing frame.
     * @property {CON_NATIVE_GAMEVAR} spawn - This defines what the weapon spawns when the spawnTime is reached.
     * @property {CON_NATIVE_GAMEVAR} spawnTime - Defines what frame the item specified by spawn will spawn on.
     * @property {CON_NATIVE_GAMEVAR} reloadSound1 - If RELOAD_TIMING is enabled, this is the first sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} reloadSound2 - If RELOAD_TIMING is enabled, this is the second sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} selectSound - The sound played when a weapon is selected.
     * @property {CON_NATIVE_GAMEVAR} fireSound - Plays the corresponding sound when the weapon counter reaches the number specified by fireDelay.
     * @property {CON_NATIVE_GAMEVAR} initialSound - Defines the sound that will play when the player starts to fire the weapon.
     * @property {CON_NATIVE_GAMEVAR} sound2Sound - This is the weapon's second sound.
     * @property {CON_NATIVE_GAMEVAR} sound2Time - If the weapon has a second shooting sound defined, this is the frame number for the second sound to start.
     */
    export interface IWeapon07 {
        /**
         * Flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        flags: CON_NATIVE_GAMEVAR<'WEAPON7_FLAGS', number>;
        clip: CON_NATIVE_GAMEVAR<'WEAPON7_CLIP', number>;
        reload: CON_NATIVE_GAMEVAR<'WEAPON7_RELOAD', number>;
        fireDelay: CON_NATIVE_GAMEVAR<'WEAPON7_FIREDELAY', number>;
        holdDelay: CON_NATIVE_GAMEVAR<'WEAPON7_HOLDDELAY', number>;
        totalTime: CON_NATIVE_GAMEVAR<'WEAPON7_TOTALTIME', number>;
        flashColor: CON_NATIVE_GAMEVAR<'WEAPON7_FLASHCOLOR', number>;
        shoots: CON_NATIVE_GAMEVAR<'WEAPON7_SHOOTS', number>;
        shotsPerBurst: CON_NATIVE_GAMEVAR<'WEAPON7_SHOTSPERBURST', number>;
        spawn: CON_NATIVE_GAMEVAR<'WEAPON7_SPAWN', number>;
        spawnTime: CON_NATIVE_GAMEVAR<'WEAPON7_SPAWNTIME', number>;
        reloadSound1: CON_NATIVE_GAMEVAR<'WEAPON7_RELOADSOUND1', number>;
        reloadSound2: CON_NATIVE_GAMEVAR<'WEAPON7_RELOADSOUND2', number>;
        selectSound: CON_NATIVE_GAMEVAR<'WEAPON7_SELECTSOUND', number>;
        fireSound: CON_NATIVE_GAMEVAR<'WEAPON7_FIRESOUND', number>;
        initialSound: CON_NATIVE_GAMEVAR<'WEAPON7_INITIALSOUND', number>;
        sound2Sound: CON_NATIVE_GAMEVAR<'WEAPON7_SOUND2SOUND', number>;
        sound2Time: CON_NATIVE_GAMEVAR<'WEAPON7_SOUND2TIME', number>;
    }
    export const weapon07, wpDevastator: CON_NATIVE_OBJECT<IWeapon07>;

    /**
     * Interface for the Tripbomb weapon (weapon 08).
     * @see {@link weapon08}
     * Use this interface to define the properties and behaviors of the weapon in the game.
     * Available properties:
     * @property {CON_NATIVE_GAMEVAR} flags - The flags for the weapon (does not control the projectile)
     * @property {CON_NATIVE_GAMEVAR} clip - It's the amount of ammo that can be fired before there is a reloading animation and pause.
     * @property {CON_NATIVE_GAMEVAR} reload - Defines the number of frames displayed in the weapon's reload sequence
     * @property {CON_NATIVE_GAMEVAR} fireDelay - Defines what frame the weapon will fire its projectile on.
     * @property {CON_NATIVE_GAMEVAR} holdDelay - The number of animation frames between shooting and reloading.
     * @property {CON_NATIVE_GAMEVAR} totalTime - Defines the total number of frames a weapon uses in its firing sequence.
     * @property {CON_NATIVE_GAMEVAR} flashColor - The flash color of the weapon.
     * @property {CON_NATIVE_GAMEVAR} shoots - This is the tilenum of the projectile.
     * @property {CON_NATIVE_GAMEVAR} shotsPerBurst - Defines the amount of projectiles that will fire when the weapon reaches its firing frame.
     * @property {CON_NATIVE_GAMEVAR} spawn - This defines what the weapon spawns when the spawnTime is reached.
     * @property {CON_NATIVE_GAMEVAR} spawnTime - Defines what frame the item specified by spawn will spawn on.
     * @property {CON_NATIVE_GAMEVAR} reloadSound1 - If RELOAD_TIMING is enabled, this is the first sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} reloadSound2 - If RELOAD_TIMING is enabled, this is the second sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} selectSound - The sound played when a weapon is selected.
     * @property {CON_NATIVE_GAMEVAR} fireSound - Plays the corresponding sound when the weapon counter reaches the number specified by fireDelay.
     * @property {CON_NATIVE_GAMEVAR} initialSound - Defines the sound that will play when the player starts to fire the weapon.
     * @property {CON_NATIVE_GAMEVAR} sound2Sound - This is the weapon's second sound.
     * @property {CON_NATIVE_GAMEVAR} sound2Time - If the weapon has a second shooting sound defined, this is the frame number for the second sound to start.
     */
    export interface IWeapon08 {
        /**
         * Flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        flags: CON_NATIVE_GAMEVAR<'WEAPON8_FLAGS', number>;
        clip: CON_NATIVE_GAMEVAR<'WEAPON8_CLIP', number>;
        reload: CON_NATIVE_GAMEVAR<'WEAPON8_RELOAD', number>;
        fireDelay: CON_NATIVE_GAMEVAR<'WEAPON8_FIREDELAY', number>;
        holdDelay: CON_NATIVE_GAMEVAR<'WEAPON8_HOLDDELAY', number>;
        totalTime: CON_NATIVE_GAMEVAR<'WEAPON8_TOTALTIME', number>;
        flashColor: CON_NATIVE_GAMEVAR<'WEAPON8_FLASHCOLOR', number>;
        shoots: CON_NATIVE_GAMEVAR<'WEAPON8_SHOOTS', number>;
        shotsPerBurst: CON_NATIVE_GAMEVAR<'WEAPON8_SHOTSPERBURST', number>;
        spawn: CON_NATIVE_GAMEVAR<'WEAPON8_SPAWN', number>;
        spawnTime: CON_NATIVE_GAMEVAR<'WEAPON8_SPAWNTIME', number>;
        reloadSound1: CON_NATIVE_GAMEVAR<'WEAPON8_RELOADSOUND1', number>;
        reloadSound2: CON_NATIVE_GAMEVAR<'WEAPON8_RELOADSOUND2', number>;
        selectSound: CON_NATIVE_GAMEVAR<'WEAPON8_SELECTSOUND', number>;
        fireSound: CON_NATIVE_GAMEVAR<'WEAPON8_FIRESOUND', number>;
        initialSound: CON_NATIVE_GAMEVAR<'WEAPON8_INITIALSOUND', number>;
        sound2Sound: CON_NATIVE_GAMEVAR<'WEAPON8_SOUND2SOUND', number>;
        sound2Time: CON_NATIVE_GAMEVAR<'WEAPON8_SOUND2TIME', number>;
    }
    export const weapon08, wpTripBomb: CON_NATIVE_OBJECT<IWeapon08>;

    /**
     * Interface for the Freezethrower weapon (weapon 09).
     * @see {@link weapon09}
     * Use this interface to define the properties and behaviors of the weapon in the game.
     * Available properties:
     * @property {CON_NATIVE_GAMEVAR} flags - The flags for the weapon (does not control the projectile)
     * @property {CON_NATIVE_GAMEVAR} clip - It's the amount of ammo that can be fired before there is a reloading animation and pause.
     * @property {CON_NATIVE_GAMEVAR} reload - Defines the number of frames displayed in the weapon's reload sequence
     * @property {CON_NATIVE_GAMEVAR} fireDelay - Defines what frame the weapon will fire its projectile on.
     * @property {CON_NATIVE_GAMEVAR} holdDelay - The number of animation frames between shooting and reloading.
     * @property {CON_NATIVE_GAMEVAR} totalTime - Defines the total number of frames a weapon uses in its firing sequence.
     * @property {CON_NATIVE_GAMEVAR} flashColor - The flash color of the weapon.
     * @property {CON_NATIVE_GAMEVAR} shoots - This is the tilenum of the projectile.
     * @property {CON_NATIVE_GAMEVAR} shotsPerBurst - Defines the amount of projectiles that will fire when the weapon reaches its firing frame.
     * @property {CON_NATIVE_GAMEVAR} spawn - This defines what the weapon spawns when the spawnTime is reached.
     * @property {CON_NATIVE_GAMEVAR} spawnTime - Defines what frame the item specified by spawn will spawn on.
     * @property {CON_NATIVE_GAMEVAR} reloadSound1 - If RELOAD_TIMING is enabled, this is the first sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} reloadSound2 - If RELOAD_TIMING is enabled, this is the second sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} selectSound - The sound played when a weapon is selected.
     * @property {CON_NATIVE_GAMEVAR} fireSound - Plays the corresponding sound when the weapon counter reaches the number specified by fireDelay.
     * @property {CON_NATIVE_GAMEVAR} initialSound - Defines the sound that will play when the player starts to fire the weapon.
     * @property {CON_NATIVE_GAMEVAR} sound2Sound - This is the weapon's second sound.
     * @property {CON_NATIVE_GAMEVAR} sound2Time - If the weapon has a second shooting sound defined, this is the frame number for the second sound to start.
     */
    export interface IWeapon09 {
        /**
         * Flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        flags: CON_NATIVE_GAMEVAR<'WEAPON9_FLAGS', number>;
        clip: CON_NATIVE_GAMEVAR<'WEAPON9_CLIP', number>;
        reload: CON_NATIVE_GAMEVAR<'WEAPON9_RELOAD', number>;
        fireDelay: CON_NATIVE_GAMEVAR<'WEAPON9_FIREDELAY', number>;
        holdDelay: CON_NATIVE_GAMEVAR<'WEAPON9_HOLDDELAY', number>;
        totalTime: CON_NATIVE_GAMEVAR<'WEAPON9_TOTALTIME', number>;
        flashColor: CON_NATIVE_GAMEVAR<'WEAPON9_FLASHCOLOR', number>;
        shoots: CON_NATIVE_GAMEVAR<'WEAPON9_SHOOTS', number>;
        shotsPerBurst: CON_NATIVE_GAMEVAR<'WEAPON9_SHOTSPERBURST', number>;
        spawn: CON_NATIVE_GAMEVAR<'WEAPON9_SPAWN', number>;
        spawnTime: CON_NATIVE_GAMEVAR<'WEAPON9_SPAWNTIME', number>;
        reloadSound1: CON_NATIVE_GAMEVAR<'WEAPON9_RELOADSOUND1', number>;
        reloadSound2: CON_NATIVE_GAMEVAR<'WEAPON9_RELOADSOUND2', number>;
        selectSound: CON_NATIVE_GAMEVAR<'WEAPON9_SELECTSOUND', number>;
        fireSound: CON_NATIVE_GAMEVAR<'WEAPON9_FIRESOUND', number>;
        initialSound: CON_NATIVE_GAMEVAR<'WEAPON9_INITIALSOUND', number>;
        sound2Sound: CON_NATIVE_GAMEVAR<'WEAPON9_SOUND2SOUND', number>;
        sound2Time: CON_NATIVE_GAMEVAR<'WEAPON9_SOUND2TIME', number>;
    }
    export const weapon09, wpFreezethrower: CON_NATIVE_OBJECT<IWeapon09>;

    /**
     * Interface for the Hand Remote weapon (weapon 10).
     * @see {@link weapon10}
     * Use this interface to define the properties and behaviors of the weapon in the game.
     * Available properties:
     * @property {CON_NATIVE_GAMEVAR} flags - The flags for the weapon (does not control the projectile)
     * @property {CON_NATIVE_GAMEVAR} clip - It's the amount of ammo that can be fired before there is a reloading animation and pause.
     * @property {CON_NATIVE_GAMEVAR} reload - Defines the number of frames displayed in the weapon's reload sequence
     * @property {CON_NATIVE_GAMEVAR} fireDelay - Defines what frame the weapon will fire its projectile on.
     * @property {CON_NATIVE_GAMEVAR} holdDelay - The number of animation frames between shooting and reloading.
     * @property {CON_NATIVE_GAMEVAR} totalTime - Defines the total number of frames a weapon uses in its firing sequence.
     * @property {CON_NATIVE_GAMEVAR} flashColor - The flash color of the weapon.
     * @property {CON_NATIVE_GAMEVAR} shoots - This is the tilenum of the projectile.
     * @property {CON_NATIVE_GAMEVAR} shotsPerBurst - Defines the amount of projectiles that will fire when the weapon reaches its firing frame.
     * @property {CON_NATIVE_GAMEVAR} spawn - This defines what the weapon spawns when the spawnTime is reached.
     * @property {CON_NATIVE_GAMEVAR} spawnTime - Defines what frame the item specified by spawn will spawn on.
     * @property {CON_NATIVE_GAMEVAR} reloadSound1 - If RELOAD_TIMING is enabled, this is the first sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} reloadSound2 - If RELOAD_TIMING is enabled, this is the second sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} selectSound - The sound played when a weapon is selected.
     * @property {CON_NATIVE_GAMEVAR} fireSound - Plays the corresponding sound when the weapon counter reaches the number specified by fireDelay.
     * @property {CON_NATIVE_GAMEVAR} initialSound - Defines the sound that will play when the player starts to fire the weapon.
     * @property {CON_NATIVE_GAMEVAR} sound2Sound - This is the weapon's second sound.
     * @property {CON_NATIVE_GAMEVAR} sound2Time - If the weapon has a second shooting sound defined, this is the frame number for the second sound to start.
     */
    export interface IWeapon10 {
        /**
         * Flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        flags: CON_NATIVE_GAMEVAR<'WEAPON10_FLAGS', number>;
        clip: CON_NATIVE_GAMEVAR<'WEAPON10_CLIP', number>;
        reload: CON_NATIVE_GAMEVAR<'WEAPON10_RELOAD', number>;
        fireDelay: CON_NATIVE_GAMEVAR<'WEAPON10_FIREDELAY', number>;
        holdDelay: CON_NATIVE_GAMEVAR<'WEAPON10_HOLDDELAY', number>;
        totalTime: CON_NATIVE_GAMEVAR<'WEAPON10_TOTALTIME', number>;
        flashColor: CON_NATIVE_GAMEVAR<'WEAPON10_FLASHCOLOR', number>;
        shoots: CON_NATIVE_GAMEVAR<'WEAPON10_SHOOTS', number>;
        shotsPerBurst: CON_NATIVE_GAMEVAR<'WEAPON10_SHOTSPERBURST', number>;
        spawn: CON_NATIVE_GAMEVAR<'WEAPON10_SPAWN', number>;
        spawnTime: CON_NATIVE_GAMEVAR<'WEAPON10_SPAWNTIME', number>;
        reloadSound1: CON_NATIVE_GAMEVAR<'WEAPON10_RELOADSOUND1', number>;
        reloadSound2: CON_NATIVE_GAMEVAR<'WEAPON10_RELOADSOUND2', number>;
        selectSound: CON_NATIVE_GAMEVAR<'WEAPON10_SELECTSOUND', number>;
        fireSound: CON_NATIVE_GAMEVAR<'WEAPON10_FIRESOUND', number>;
        initialSound: CON_NATIVE_GAMEVAR<'WEAPON10_INITIALSOUND', number>;
        sound2Sound: CON_NATIVE_GAMEVAR<'WEAPON10_SOUND2SOUND', number>;
        sound2Time: CON_NATIVE_GAMEVAR<'WEAPON10_SOUND2TIME', number>;
    }
    export const weapon10, wpHandRemote: CON_NATIVE_OBJECT<IWeapon10>;

    /**
     * Interface for the Expander weapon (weapon 11).
     * @see {@link weapon11}
     * Use this interface to define the properties and behaviors of the weapon in the game.
     * Available properties:
     * @property {CON_NATIVE_GAMEVAR} flags - The flags for the weapon (does not control the projectile)
     * @property {CON_NATIVE_GAMEVAR} clip - It's the amount of ammo that can be fired before there is a reloading animation and pause.
     * @property {CON_NATIVE_GAMEVAR} reload - Defines the number of frames displayed in the weapon's reload sequence
     * @property {CON_NATIVE_GAMEVAR} fireDelay - Defines what frame the weapon will fire its projectile on.
     * @property {CON_NATIVE_GAMEVAR} holdDelay - The number of animation frames between shooting and reloading.
     * @property {CON_NATIVE_GAMEVAR} totalTime - Defines the total number of frames a weapon uses in its firing sequence.
     * @property {CON_NATIVE_GAMEVAR} flashColor - The flash color of the weapon.
     * @property {CON_NATIVE_GAMEVAR} shoots - This is the tilenum of the projectile.
     * @property {CON_NATIVE_GAMEVAR} shotsPerBurst - Defines the amount of projectiles that will fire when the weapon reaches its firing frame.
     * @property {CON_NATIVE_GAMEVAR} spawn - This defines what the weapon spawns when the spawnTime is reached.
     * @property {CON_NATIVE_GAMEVAR} spawnTime - Defines what frame the item specified by spawn will spawn on.
     * @property {CON_NATIVE_GAMEVAR} reloadSound1 - If RELOAD_TIMING is enabled, this is the first sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} reloadSound2 - If RELOAD_TIMING is enabled, this is the second sound to be played in the weapon's reload sequence.
     * @property {CON_NATIVE_GAMEVAR} selectSound - The sound played when a weapon is selected.
     * @property {CON_NATIVE_GAMEVAR} fireSound - Plays the corresponding sound when the weapon counter reaches the number specified by fireDelay.
     * @property {CON_NATIVE_GAMEVAR} initialSound - Defines the sound that will play when the player starts to fire the weapon.
     * @property {CON_NATIVE_GAMEVAR} sound2Sound - This is the weapon's second sound.
     * @property {CON_NATIVE_GAMEVAR} sound2Time - If the weapon has a second shooting sound defined, this is the frame number for the second sound to start.
     */
    export interface IWeapon11 {
        /**
         * Flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        flags: CON_NATIVE_GAMEVAR<'WEAPON11_FLAGS', number>;
        clip: CON_NATIVE_GAMEVAR<'WEAPON11_CLIP', number>;
        reload: CON_NATIVE_GAMEVAR<'WEAPON11_RELOAD', number>;
        fireDelay: CON_NATIVE_GAMEVAR<'WEAPON11_FIREDELAY', number>;
        holdDelay: CON_NATIVE_GAMEVAR<'WEAPON11_HOLDDELAY', number>;
        totalTime: CON_NATIVE_GAMEVAR<'WEAPON11_TOTALTIME', number>;
        flashColor: CON_NATIVE_GAMEVAR<'WEAPON11_FLASHCOLOR', number>;
        shoots: CON_NATIVE_GAMEVAR<'WEAPON11_SHOOTS', number>;
        shotsPerBurst: CON_NATIVE_GAMEVAR<'WEAPON11_SHOTSPERBURST', number>;
        spawn: CON_NATIVE_GAMEVAR<'WEAPON11_SPAWN', number>;
        spawnTime: CON_NATIVE_GAMEVAR<'WEAPON11_SPAWNTIME', number>;
        reloadSound1: CON_NATIVE_GAMEVAR<'WEAPON11_RELOADSOUND1', number>;
        reloadSound2: CON_NATIVE_GAMEVAR<'WEAPON11_RELOADSOUND2', number>;
        selectSound: CON_NATIVE_GAMEVAR<'WEAPON11_SELECTSOUND', number>;
        fireSound: CON_NATIVE_GAMEVAR<'WEAPON11_FIRESOUND', number>;
        initialSound: CON_NATIVE_GAMEVAR<'WEAPON11_INITIALSOUND', number>;
        sound2Sound: CON_NATIVE_GAMEVAR<'WEAPON11_SOUND2SOUND', number>;
        sound2Time: CON_NATIVE_GAMEVAR<'WEAPON11_SOUND2TIME', number>;
    }
    export const weapon11, wpExpander: CON_NATIVE_OBJECT<IWeapon11>;

    /**
     * Use this interface to create a faster switch. **Only literal constant values are allowed**
     * @property {constant} values holds the values that trigger this clause
     * @property {object} range holds the range @property {constant} start and @property {constant} end of the clause
     * @property {constant} exclude holds the values that are excluded from triggering this clause
     * @property {constant} code an arrow function that gets executed once the clause is triggered
     * @interface IFastSwitch
     */
    interface IFastSwitch {
        /** Holds the values that trigger this clause */
        values?: constant[],
        /** Holds the range @property {constant} start and @property {constant} end of the clause */
        range?: {
            start: constant,
            end: constant
        },
        /** Holds the values that are excluded from triggering this clause */
        exclude?: constant[],
        /** An arrow function that gets executed once the clause is triggered */
        code: () => void
    }

    /**
     * Fast switch allows to write a faster switch operation
     * @param cases An array of {@link IFastSwitch} containing clauses
     */
    export function FastSwitch(cases: IFastSwitch[]);

    export interface IPlayerWeapon {
        ammoAmount: CON_NATIVE<number[]>;
        gotWeapon: CON_NATIVE<number[]>;
        maxAmmoAmount: CON_NATIVE<number[]>;
        subOrNot: CON_NATIVE<number[]>
        currWeapon: CON_NATIVE<number>;
        weaponAnim: CON_NATIVE<number>;
        bSubWeapon: CON_NATIVE<number>;
        hbombHoldDelay: CON_NATIVE<number>;
        hbombOn: CON_NATIVE<number>;
        holsterWeapon: CON_NATIVE<number>;
        kickbackPic: CON_NATIVE<number>;
        subWeapon: CON_NATIVE<number>;
        reloading: CON_NATIVE<number>;
    }

    export interface IPlayerInventory {
        bootAmount: CON_NATIVE<number>;
        firstaidAmount: CON_NATIVE<number>;
        gotAccess: CON_NATIVE<number>;
        heatAmount: CON_NATIVE<number>;
        heatOn: CON_NATIVE<number>;
        holodukeAmount: CON_NATIVE<number>;
        holodukeOn: CON_NATIVE<number>;
        invdisptime: CON_NATIVE<number>;
        invenIcon: CON_NATIVE<number>;
        jetpackAmount: CON_NATIVE<number>;
        jetpackOn: CON_NATIVE<number>;
        refreshInventory: CON_NATIVE<number>;
        scubaAmount: CON_NATIVE<number>;
        scubaOn: CON_NATIVE<number>;
        shieldAmount: CON_NATIVE<number>;
        maxShieldAmount: CON_NATIVE<number>;
        steroidsAmount: CON_NATIVE<number>;
    }

    class CPlayer {
        public actor: CON_NATIVE<CActor>;

        public aimMode: CON_NATIVE<number>;
        public autoAim: CON_NATIVE<number>;
        public weaponSwitch: CON_NATIVE<number>;

        public cheatPhase: CON_NATIVE<number>;

        public bobCounter: CON_NATIVE<number>;
        public bobPos: CON_NATIVE<vec2>;

        public crackTime: CON_NATIVE<number>;
        public fistIncs: CON_NATIVE<number>;

        public kneeIncs: CON_NATIVE<number>;
        public knuckleIncs: CON_NATIVE<number>;

        public lastFullWeapon: CON_NATIVE<number>;
        public lastQuickKick: CON_NATIVE<number>;
        public lastPissedTime: CON_NATIVE<number>;
        public lastWeapon: CON_NATIVE<number>;
        public lastUsedWeapon: CON_NATIVE<number>;

        public quickKick: CON_NATIVE<number>;
        public randomClubFrame: CON_NATIVE<number>;
        public rapidFireHold: CON_NATIVE<number>;

        public showEmptyWeapon: CON_NATIVE<number>;

        public weaponSystem: CON_NATIVE<IPlayerWeapon>;

        public wantWeaponFire: CON_NATIVE<number>;
        public weaponAng: CON_NATIVE<number>;
        public weaponPos: CON_NATIVE<number>;
        public weaponSway: CON_NATIVE<number>;
        public weapRecs: CON_NATIVE<number[]>;
        public weapRecCNT: CON_NATIVE<number>;

        public inventory: CON_NATIVE<IPlayerInventory>;

        public ang: CON_NATIVE<number>;
        public currSector: CON_NATIVE<ISector>;
        public currSectorID: CON_NATIVE<number>;

        public i: CON_NATIVE<number>;
        public index: CON_NATIVE<number>;

        public previousAng: CON_NATIVE<number>;

        public previousPos: CON_NATIVE<vec3>;
        public pos: CON_NATIVE<vec3>;
        public vel: CON_NATIVE<vec3>;

        public angVel: CON_NATIVE<number>;
        public crouchToggle: CON_NATIVE<number>;

        public runSpeed: CON_NATIVE<number>;
        public jumpingCounter: CON_NATIVE<number>;
        public jumpingToggle: CON_NATIVE<number>;
        public movementLock: CON_NATIVE<number>;

        public deadFlag: CON_NATIVE<number>;

        public horiz: CON_NATIVE<number>;
        public verticalAngle: CON_NATIVE<number>;

        public verticalAngleOff: CON_NATIVE<number>;
        public horizOff: CON_NATIVE<number>;

        public hudpal: CON_NATIVE<number>;
        public lookAng: CON_NATIVE<number>;
        public newowner: CON_NATIVE<number>;
        public opositeYoff: CON_NATIVE<number>;
        public overShoulderOn: CON_NATIVE<number>;
        public palette: CON_NATIVE<number>;
        public palookup: CON_NATIVE<number>;
        public pals: CON_NATIVE<number[]>;
        public palsTime: CON_NATIVE<number>;
        public opositeHoriz: CON_NATIVE<number>;
        public opositeHorizoff: CON_NATIVE<number>;
        public pycount: CON_NATIVE<number>;
        public pyoff: CON_NATIVE<number>;
        public returnToCenter: CON_NATIVE<number>;
        public rotscrnang: CON_NATIVE<number>;
        public visibility: CON_NATIVE<number>;
        public zoom: CON_NATIVE<number>;

        public fta: CON_NATIVE<number>;
        public ftq: CON_NATIVE<number>;

        public actorsKilled: CON_NATIVE<number>;
        public maxActorsKilled: CON_NATIVE<number>;
        public maxSecretRooms: CON_NATIVE<number>;
        public playerPar: CON_NATIVE<number>;
        public secretRooms: CON_NATIVE<number>;

        public connected: CON_NATIVE<number>;
        public deaths: CON_NATIVE<number>;
        public frag: CON_NATIVE<number>;
        public fragPs: CON_NATIVE<number>;
        public fraggedSelf: CON_NATIVE<number>;
        public frags: CON_NATIVE<number>;
        public interfaceToggleFlag: CON_NATIVE<number>;
        public team: CON_NATIVE<number>;

        public exitx: CON_NATIVE<number[]>;
        public exity: CON_NATIVE<number[]>;
        public lastrandomspot: CON_NATIVE<number[]>;
        public name: CON_NATIVE<string[]>;
        public randomflamex: CON_NATIVE<number[]>;

        public accessIncs: CON_NATIVE<number>;
        public accessSpritenum: CON_NATIVE<number>;
        public accessWallnum: CON_NATIVE<number>;
        public actorsqu: CON_NATIVE<number>;
        public airleft: CON_NATIVE<number>;
        public autostep: CON_NATIVE<number>;
        public autostepSbw: CON_NATIVE<number>;
        public buttonpalette: CON_NATIVE<number>;
        public customexitsound: CON_NATIVE<number>;
        public dummyplayersprite: CON_NATIVE<number>;
        public extra_extra8: CON_NATIVE<number>;
        public fallingCounter: CON_NATIVE<number>;
        public footprintcount: CON_NATIVE<number>;
        public footprintpal: CON_NATIVE<number>;
        public footprintshade: CON_NATIVE<number>;
        public gm: CON_NATIVE<number>;
        public hardLanding: CON_NATIVE<number>;
        public hurtDelay: CON_NATIVE<number>;
        public lastExtra: CON_NATIVE<number>;

        public loogCNT: CON_NATIVE<number>;
        public numloogs: CON_NATIVE<number>;
        public loogiePos: CON_NATIVE<vec2>;

        public maxPlayerHealth: CON_NATIVE<number>;

        public onCrane: CON_NATIVE<number>;
        public onGround: CON_NATIVE<number>;
        public onWarpingSector: CON_NATIVE<number>;
        public oneEightyCount: CON_NATIVE<number>;
        public oneParallaxSectnum: CON_NATIVE<number>;
        public sbs: CON_NATIVE<number>;
        public screamVoice: CON_NATIVE<number>;
        public somethingonplayer: CON_NATIVE<number>;
        public soundPitch: CON_NATIVE<number>;
        public spritebridge: CON_NATIVE<number>;
        public timebeforeexit: CON_NATIVE<number>;
        public tipincs: CON_NATIVE<number>;
        public toggleKeyFlag: CON_NATIVE<number>;
        public transporterHold: CON_NATIVE<number>;
        public truefz: CON_NATIVE<number>;
        public truecz: CON_NATIVE<number>;
        public wackedbyactor: CON_NATIVE<number>;
        public walkingSndToggle: CON_NATIVE<number>;

        /** Maximum player health */
        public health: CON_NATIVE<number>;
        /** Shield amount */
        public shieldAmount: CON_NATIVE<number>;
        /** Jetpack fuel amount */
        public jetpackAmount: CON_NATIVE<number>;
        /** Scuba gear amount */
        public scubaAmount: CON_NATIVE<number>;
        /** Steroids amount */
        public steroidsAmount: CON_NATIVE<number>;
        /** Weapon animation frame */
        public kickbackPic: CON_NATIVE<number>;
        /** Whether player is jumping */
        public jumping: CON_NATIVE<boolean>;
        /** Whether player is crouching */
        public crouching: CON_NATIVE<boolean>;
        /** Dead flag */
        public dead: CON_NATIVE<boolean>;
        /** Player's sprite index */
        public spriteIndex: CON_NATIVE<number>;
        /** Grouped consumable resources: health, shield, jetpack, scuba, steroids */
        public resources: CON_NATIVE<{ health: number; shield: number; jetpack: number; scuba: number; steroids: number; }>;
        /** Grouped movement/state flags: onGround, jumping, crouching, dead */
        public status: CON_NATIVE<{ onGround: boolean; jumping: boolean; crouching: boolean; dead: boolean; }>;
        /** Level statistics: actorsKilled, secretRooms */
        public stats: CON_NATIVE<{ actorsKilled: number; secretRooms: number; }>;
        public q16Horiz: CON_NATIVE<number>;
        public q16HorizOff: CON_NATIVE<number>;
        public oq16Horiz: CON_NATIVE<number>;
        public oq16HorizOff: CON_NATIVE<number>;
        public q16Ang: CON_NATIVE<number>;
        public oq16Ang: CON_NATIVE<number>;
        public q16AngVel: CON_NATIVE<number>;
        public gravity: CON_NATIVE<number>;
        public floorZOffset: CON_NATIVE<number>;
        public spriteZOffset: CON_NATIVE<number>;
        public minWaterZDist: CON_NATIVE<number>;
        public waterZOffset: CON_NATIVE<number>;
        public shrunkZOffset: CON_NATIVE<number>;
        public crouchZIncrement: CON_NATIVE<number>;
        public crouchSpeedModifier: CON_NATIVE<number>;
        public swimSpeedModifier: CON_NATIVE<number>;
        public swimZIncrement: CON_NATIVE<number>;
        public minSwimZVel: CON_NATIVE<number>;
        public maxSwimZVel: CON_NATIVE<number>;
        public jetpackZIncrement: CON_NATIVE<number>;
        public invDispTime: CON_NATIVE<number>;
        public bobPosX: CON_NATIVE<number>;
        public bobPosY: CON_NATIVE<number>;
        public pyOff: CON_NATIVE<number>;
        public opyOff: CON_NATIVE<number>;
        public trueFZ: CON_NATIVE<number>;
        public trueCZ: CON_NATIVE<number>;
        public oLookAng: CON_NATIVE<number>;
        public oRotScrnAng: CON_NATIVE<number>;
        public subweapon: CON_NATIVE<number>;
        public wackedByActor: CON_NATIVE<number>;
        public tipIncs: CON_NATIVE<number>;
        public holoDukeAmount: CON_NATIVE<number>;
        public newOwner: CON_NATIVE<number>;
        public hbombHoldDelay: CON_NATIVE<number>;
        public airLeft: CON_NATIVE<number>;
        public accessWallNum: CON_NATIVE<number>;
        public accessSpriteNum: CON_NATIVE<number>;
        public gotAccess: CON_NATIVE<number>;
        public firstAidAmount: CON_NATIVE<number>;
        public somethingOnPlayer: CON_NATIVE<number>;
        public parallaxSectnum: CON_NATIVE<number>;
        public dummyPlayerSprite: CON_NATIVE<number>;
        public extraExtra8: CON_NATIVE<number>;
        public heatAmount: CON_NATIVE<number>;
        public actorSqu: CON_NATIVE<number>;
        public timeBeforeExit: CON_NATIVE<number>;
        public customExitSound: CON_NATIVE<number>;
        public weapRecCnt: CON_NATIVE<number>;
        public interfaceToggle: CON_NATIVE<number>;
        public rotScrnAng: CON_NATIVE<number>;
        public holoDukeOn: CON_NATIVE<number>;
        public pyCount: CON_NATIVE<number>;
        public clipDist: CON_NATIVE<number>;
        public footprintShade: CON_NATIVE<number>;
        public bootAmount: CON_NATIVE<number>;
        public footprintCount: CON_NATIVE<number>;
        public hbombOn: CON_NATIVE<number>;
        public invenIcon: CON_NATIVE<number>;
        public buttonPalette: CON_NATIVE<number>;
        public jetpackOn: CON_NATIVE<number>;
        public spriteBridge: CON_NATIVE<number>;
        public scubaOn: CON_NATIVE<number>;
        public footprintPal: CON_NATIVE<number>;
        public heatOn: CON_NATIVE<number>;
        public holsterWeapon: CON_NATIVE<number>;
        public reloading: CON_NATIVE<number>;
        public maxShieldAmount: CON_NATIVE<number>;
        public autoStep: CON_NATIVE<number>;
        public autoStepSbw: CON_NATIVE<number>;
        public floorZRebound: CON_NATIVE<number>;
        public floorZCutoff: CON_NATIVE<number>;
        public numLoogs: CON_NATIVE<number>;
        public loogCnt: CON_NATIVE<number>;

        constructor(
            picnum: constant,
            health: constant
        )

        Main(first_action?: IAction);

        protected Events: OnEvent;
    }

    const players: CPlayer[];

    /**
     * Projectile type definition — one entry per projectile type (indexed by picnum).
     * Read and write via `projectiles[picnum].xxx`.
     */
    export interface IProjectile {
        /** Base travel speed of the projectile */
        vel: CON_NATIVE<number>;
        /** Speed multiplier applied each frame */
        velMult: CON_NATIVE<number>;
        /** Number of times the projectile can bounce before disappearing */
        bounces: CON_NATIVE<number>;
        /** Sound played when the projectile bounces */
        bSound: CON_NATIVE<number>;
        /** Sound played when the projectile is first fired */
        iSound: CON_NATIVE<number>;
        /** Sound played on impact / explosion */
        sound: CON_NATIVE<number>;
        /** Maximum travel distance before the projectile expires */
        range: CON_NATIVE<number>;
        /** Gravity drop applied per frame (0 = no gravity) */
        drop: CON_NATIVE<number>;
        /** Explosion hit radius for radial damage */
        hitRadius: CON_NATIVE<number>;
        /** Launch offset from the owner sprite */
        offset: CON_NATIVE<number>;
        /** Tile number of the trail sprite (0 = none) */
        trail: CON_NATIVE<number>;
        /** Tile number of the trail sprite type */
        tnum: CON_NATIVE<number>;
        /** Offset between successive trail sprites */
        tOffset: CON_NATIVE<number>;
        /** Trail sprite X repeat scale */
        txRepeat: CON_NATIVE<number>;
        /** Trail sprite Y repeat scale */
        tyRepeat: CON_NATIVE<number>;
        /** Projectile sprite X repeat scale */
        sxRepeat: CON_NATIVE<number>;
        /** Projectile sprite Y repeat scale */
        syRepeat: CON_NATIVE<number>;
        /** Shade applied to the projectile sprite */
        shade: CON_NATIVE<number>;
        /** Palette index applied to the projectile sprite */
        pal: CON_NATIVE<number>;
        /** Sprite status flags (cstat bit-field) */
        cstat: CON_NATIVE<number>;
        /** Collision clip distance */
        clipDist: CON_NATIVE<number>;
        /** Decal tile spawned on wall impact */
        decal: CON_NATIVE<number>;
        /** Extra damage value */
        extra: CON_NATIVE<number>;
        /** Random extra damage range added to `extra` */
        extraRand: CON_NATIVE<number>;
        /** User-defined data field */
        userdata: CON_NATIVE<number>;
        /** RGB flash color on impact (packed 0xRRGGBB) */
        flashColor: CON_NATIVE<number>;
        /** Tile spawned on impact */
        spawns: CON_NATIVE<number>;
        /** Tile number of another projectile this one behaves like */
        worksLike: CON_NATIVE<number>;
        /** X repeat scale of the projectile sprite */
        xRepeat: CON_NATIVE<number>;
        /** Y repeat scale of the projectile sprite */
        yRepeat: CON_NATIVE<number>;
        /** Trail sprite repeat grouped: `x` = txRepeat, `y` = tyRepeat */
        trailRepeat: CON_NATIVE<vec2>;
        /** Projectile sprite repeat grouped: `x` = sxRepeat, `y` = syRepeat */
        spriteRepeat: CON_NATIVE<vec2>;
        /** Flight physics grouped: vel, velMult, drop, range, bounces, offset, clipDist */
        physics: CON_NATIVE<{ vel: number; velMult: number; drop: number; range: number; bounces: number; offset: number; clipDist: number; }>;
        /** Sounds grouped: fire (iSound), bounce (bSound), impact (sound) */
        audio: CON_NATIVE<{ fire: number; bounce: number; impact: number; }>;
        /** Trail sprite config grouped: enabled, sprite, offset, txRepeat, tyRepeat, sxRepeat, syRepeat */
        trailConfig: CON_NATIVE<{ enabled: number; sprite: number; offset: number; txRepeat: number; tyRepeat: number; sxRepeat: number; syRepeat: number; }>;
        /** Visual appearance grouped: shade, pal, cstat, xRepeat, yRepeat */
        appearance: CON_NATIVE<{ shade: number; pal: number; cstat: number; xRepeat: number; yRepeat: number; }>;
        /** Impact effects grouped: hitRadius, decal, flashColor, extra, extraRand, spawns */
        effect: CON_NATIVE<{ hitRadius: number; decal: number; flashColor: number; extra: number; extraRand: number; spawns: number; }>;
    }

    /**
     * Base class for declaring sprite-based projectiles (non-hitscan).
     * Extend this class to define a new projectile type via `defineprojectile`.
     *
     * In the constructor body, assign IProjectile fields (`this.vel`, `this.extra`, …)
     * to emit `defineprojectile` directives. Define `Main()` for per-frame actor behaviour.
     * If `Main()` is omitted the class emits only `defineprojectile` calls (hitscan-safe).
     *
     * Supports actions, moves, AIs, custom properties, OnEvent, and OnVariation —
     * identical to {@link CActor}, except the actor block always uses `actor` (non-enemy).
     */
    export class CProjectile {
        // ── defineprojectile fields (assign in constructor body) ─────────────
        /** Base travel speed */
        public vel: CON_NATIVE<number>;
        /** Per-frame speed multiplier */
        public velMult: CON_NATIVE<number>;
        /** Number of bounces before the projectile disappears */
        public bounces: CON_NATIVE<number>;
        /** Gravity drop per frame */
        public drop: CON_NATIVE<number>;
        /** Maximum travel distance */
        public range: CON_NATIVE<number>;
        /** Launch offset from owner sprite */
        public offset: CON_NATIVE<number>;
        /** Collision clip distance */
        public clipDist: CON_NATIVE<number>;
        /** Sound on fire */
        public iSound: CON_NATIVE<number>;
        /** Sound on bounce */
        public bSound: CON_NATIVE<number>;
        /** Sound on impact */
        public sound: CON_NATIVE<number>;
        /** Trail sprite tile (0 = none) */
        public trail: CON_NATIVE<number>;
        /** Trail sprite type */
        public tnum: CON_NATIVE<number>;
        /** Offset between trail sprites */
        public tOffset: CON_NATIVE<number>;
        /** Trail sprite X repeat */
        public txRepeat: CON_NATIVE<number>;
        /** Trail sprite Y repeat */
        public tyRepeat: CON_NATIVE<number>;
        /** Projectile sprite X repeat */
        public sxRepeat: CON_NATIVE<number>;
        /** Projectile sprite Y repeat */
        public syRepeat: CON_NATIVE<number>;
        /** Shade */
        public shade: CON_NATIVE<number>;
        /** Palette index */
        public pal: CON_NATIVE<number>;
        /** Sprite status flags */
        public cstat: CON_NATIVE<number>;
        /** X repeat scale */
        public xRepeat: CON_NATIVE<number>;
        /** Y repeat scale */
        public yRepeat: CON_NATIVE<number>;
        /** Explosion hit radius */
        public hitRadius: CON_NATIVE<number>;
        /** Damage (projectile extra, not actor health) */
        public extra: CON_NATIVE<number>;
        /** Random damage range added to extra */
        public extraRand: CON_NATIVE<number>;
        /** Decal tile on wall impact */
        public decal: CON_NATIVE<number>;
        /** RGB flash color on impact */
        public flashColor: CON_NATIVE<number>;
        /** Tile spawned on impact */
        public spawns: CON_NATIVE<number>;
        /** Tile this projectile behaves like */
        public worksLike: CON_NATIVE<number>;
        /** User-defined data */
        public userdata: CON_NATIVE<number>;

        // ── sprite/actor properties (available inside Main()) ─────────────────
        /** Tile number of the sprite */
        public picnum: CON_NATIVE<number>;
        /** Sprite position */
        public pos: CON_NATIVE<vec3>;
        /** Sprite angle */
        public ang: CON_NATIVE<number>;
        /** Owner sprite index */
        public owner: CON_NATIVE<number>;
        /** Sprite velocity */
        public vel2: CON_NATIVE<vec3>;
        /** Palette */
        public pal2: CON_NATIVE<number>;
        /** Shade/brightness */
        public shade2: CON_NATIVE<number>;
        /** Condition status flags */
        public cstat2: CON_NATIVE<number>;
        /** Sprite status list */
        public statnum: CON_NATIVE<number>;
        /** Repeat scaling */
        public repeat: CON_NATIVE<vec2>;
        /** Texture offset */
        public texOffset: CON_NATIVE<vec2>;
        /** Current sector */
        public curSector: CON_NATIVE<ISector>;
        /** Current sector ID */
        public curSectorID: CON_NATIVE<number>;
        /** Distance to nearest player */
        public playerDist: CON_NATIVE<number>;
        /** Current action pointer */
        public curAction: CON_NATIVE<number>;
        /** Current move pointer */
        public curMove: CON_NATIVE<number>;
        /** Current AI pointer */
        public curAI: CON_NATIVE<number>;
        /** Sprite flags */
        public flags: CON_NATIVE<number>;
        /** Lotag/Hitag */
        public tags: CON_NATIVE<tag>;
        /** Alpha transparency */
        public alpha: CON_NATIVE<number>;
        /** Blend mode */
        public blend: CON_NATIVE<number>;
        /** Pitch rotation */
        public pitch: CON_NATIVE<number>;
        /** Roll rotation */
        public roll: CON_NATIVE<number>;

        // ── actions / moves / AIs ─────────────────────────────────────────────
        protected actions: TAction<string>;
        protected moves: TMove<string>;
        protected ais: TAi<string>;

        /**
         * Declare a new projectile type.
         * @param picnum - tile number of the projectile sprite
         * @param extra - (optional) initial sprite health for the actor block (rarely needed; projectile damage is set via `this.extra` in the body)
         */
        constructor(picnum: constant, extra?: constant)

        // ── helper methods (same as CActor) ───────────────────────────────────
        public PlayAction(action: IAction | null): CON_NATIVE<void>
        public Move(move: IMove | null, flags: number): CON_NATIVE<void>
        public StartAI(ai: IAi | null): CON_NATIVE<void>
        public CStat(stats?: number): CON_NATIVE<number>
        public CStatOR(stats: number): CON_NATIVE<void>
        public SizeAt(w: number, h: number): CON_NATIVE<void>
        public SizeTo(w: number, h: number, inc_x?: number, inc_y?: number): CON_NATIVE<void>
        public Count(value?: number): CON_NATIVE<number>
        public ActionCount(value?: number): CON_NATIVE<number>
        public Fall(): CON_NATIVE<void>
        public KillIt(): CON_NATIVE<void>
        public Stop(): CON_NATIVE<void>
        public ResetAction(): CON_NATIVE<void>
        public Spawn(picnum: number | CActor, initFn?: ((id: number) => void), queued?: boolean): CON_NATIVE<number>
        public Shoot(picnum: number | CActor, initFn?: ((id: number) => void), use_zvel?: boolean, zvel?: number, additive_zvel?: boolean): CON_NATIVE<number>
        public HitRadius(radius: number, furthestDmg: number, farDmg: number, closeDmg: number, closestDmg: number): CON_NATIVE<void>
        public Flash(): CON_NATIVE<void>
        public Sound(sound_id: number | Sound, global?: boolean, once?: boolean): CON_NATIVE<void>
        public StopSound(sound_id: number | Sound): CON_NATIVE<void>
        public IsAwayFromWall(): CON_NATIVE<boolean>
        public IsInWater(): CON_NATIVE<boolean>
        public IsOnWater(): CON_NATIVE<boolean>
        public IsOutside(): CON_NATIVE<boolean>
        public IsRandom(value: number): CON_NATIVE<boolean>
        public IsDead(): CON_NATIVE<boolean>
        public Squished(): CON_NATIVE<boolean>
        public BulletNear(): CON_NATIVE<boolean>
        /**
         * Must be called frequently in `Main()` for the projectile to receive weapon damage.
         */
        public HitByWeapon(): CON_NATIVE<boolean>
        public WhichWeaponHit(): CON_NATIVE<number>
        public Pal(color: number): CON_NATIVE<void>
        public Debris(tile: constant, amount: constant): CON_NATIVE<void>
        public Guts(tile: constant, amount: constant): CON_NATIVE<void>

        /**
         * Define per-frame behaviour. Omit for hitscan projectiles (no actor block emitted).
         */
        protected Main(first_action?: IAction): void;

        /** Per-projectile-sprite events. See {@link OnEvent} */
        protected Events: OnEvent;

        protected Variations: OnVariation<CProjectile>;
    }

    /**
     * Temporary sprite — a draw-list entry built each frame by the renderer.
     * Read-only during `DisplayRest` / `DisplayView` events via `tsprites[i].xxx`.
     * Changes only affect rendering for the current frame; they are not persistent.
     */
    export interface ITSprite {
        /** World position `{x, y, z}` */
        pos: CON_NATIVE<vec3>;
        /** Velocity `{x: xvel, y: yvel, z: zvel}` */
        vel: CON_NATIVE<vec3>;
        /** Sprite repeat scale `{x: xrepeat, y: yrepeat}` */
        repeat: CON_NATIVE<vec2>;
        /** Sprite texture offset `{x: xoffset, y: yoffset}` */
        offset: CON_NATIVE<vec2>;
        /** Sprite angle in BUILD angle units (0–2047) */
        ang: CON_NATIVE<number>;
        /** Tile number used to draw the sprite */
        picnum: CON_NATIVE<number>;
        /** Shade level (−128 bright … 127 dark) */
        shade: CON_NATIVE<number>;
        /** Palette lookup index */
        pal: CON_NATIVE<number>;
        /** Sprite status flags (cstat bit-field) */
        cstat: CON_NATIVE<number>;
        /** Sprite index of the owning actor */
        owner: CON_NATIVE<number>;
        /** Status list the sprite belongs to */
        statnum: CON_NATIVE<number>;
        /** Sector the sprite is currently in */
        sectnum: CON_NATIVE<number>;
        /** Extra / health value */
        extra: CON_NATIVE<number>;
        /** Collision clip distance */
        clipDist: CON_NATIVE<number>;
        /** Translucency blend mode (0 = solid) */
        blend: CON_NATIVE<number>;
        /** Lotag and hitag `{lotag, hitag}` */
        tags: CON_NATIVE<tag>;
    }

    /**
     * Global game settings and state accessible from CON scripts.
     * Indexed by player ID — `userdef[0]` or `userdef[THISACTOR]` for the current player.
     */
    export interface IUserDef {
        /** Screen brightness (0–15) */
        brightness: CON_NATIVE<number>;
        /** God mode active for this player (1 = on) */
        god: CON_NATIVE<number>;
        /** Current level number (0-based within the episode) */
        levelNum: CON_NATIVE<number>;
        /** Current episode / volume number (0-based) */
        volumeNum: CON_NATIVE<number>;
        /** Multiplayer mode (0 = deathmatch, 1 = co-op, etc.) */
        multiMode: CON_NATIVE<number>;
        /** Episode number for the currently playing music track */
        musicEpisode: CON_NATIVE<number>;
        /** Level number for the currently playing music track */
        musicLevel: CON_NATIVE<number>;
        /** Difficulty skill level (0 = easiest) */
        playerSkill: CON_NATIVE<number>;
        /** Auto-map scroll mode */
        scrollMode: CON_NATIVE<number>;
        /** HUD screen size setting (0 = full, higher = smaller) */
        screenSize: CON_NATIVE<number>;
        /** Co-op mode flag (1 = co-op active) */
        coop: CON_NATIVE<number>;
        /** General-purpose return value array used by events (CON `return` field, indices 0–8) */
        returnData: CON_NATIVE<number[]>;
        /** Level info grouped: `number`, `volume`, `skill`, `musicEpisode`, `musicLevel` */
        level: CON_NATIVE<{ number: number; volume: number; skill: number; musicEpisode: number; musicLevel: number; }>;
        /** Screen settings grouped: `brightness`, `size`, `scrollMode` */
        screen: CON_NATIVE<{ brightness: number; size: number; scrollMode: number; }>;
        /** Multiplayer settings grouped: `mode`, `coop` */
        multi: CON_NATIVE<{ mode: number; coop: number; }>;
        warpOn: CON_NATIVE<number>;
        cashman: CON_NATIVE<number>;
        eog: CON_NATIVE<number>;
        showAllMap: CON_NATIVE<number>;
        showHelp: CON_NATIVE<number>;
        clipping: CON_NATIVE<number>;
        overheadOn: CON_NATIVE<number>;
        lastOverhead: CON_NATIVE<number>;
        showWeapons: CON_NATIVE<number>;
        pauseOn: CON_NATIVE<number>;
        fromBonus: CON_NATIVE<number>;
        cameraSprite: CON_NATIVE<number>;
        lastCamSprite: CON_NATIVE<number>;
        lastLevel: CON_NATIVE<number>;
        secretLevel: CON_NATIVE<number>;
        constVisibility: CON_NATIVE<number>;
        uwFramerate: CON_NATIVE<number>;
        cameraTime: CON_NATIVE<number>;
        folFvel: CON_NATIVE<number>;
        folSvel: CON_NATIVE<number>;
        folAvel: CON_NATIVE<number>;
        folX: CON_NATIVE<number>;
        folY: CON_NATIVE<number>;
        folA: CON_NATIVE<number>;
        recCnt: CON_NATIVE<number>;
        enteredName: CON_NATIVE<number>;
        screenTilting: CON_NATIVE<number>;
        shadows: CON_NATIVE<number>;
        ftaOn: CON_NATIVE<number>;
        executions: CON_NATIVE<number>;
        autoRun: CON_NATIVE<number>;
        coords: CON_NATIVE<number>;
        tickrate: CON_NATIVE<number>;
        mCoop: CON_NATIVE<number>;
        screenSizeUD: CON_NATIVE<number>;
        lockout: CON_NATIVE<number>;
        crosshair: CON_NATIVE<number>;
        playerAI: CON_NATIVE<number>;
        respawnMonsters: CON_NATIVE<number>;
        respawnItems: CON_NATIVE<number>;
        respawnInventory: CON_NATIVE<number>;
        recstat: CON_NATIVE<number>;
        monstersOff: CON_NATIVE<number>;
        mRespawnItems: CON_NATIVE<number>;
        mRespawnMonsters: CON_NATIVE<number>;
        mRespawnInventory: CON_NATIVE<number>;
        mRecstat: CON_NATIVE<number>;
        mMonstersOff: CON_NATIVE<number>;
        udDetail: CON_NATIVE<number>;
        mFfire: CON_NATIVE<number>;
        ffire: CON_NATIVE<number>;
        mPlayerSkill: CON_NATIVE<number>;
        mLevelNumber: CON_NATIVE<number>;
        mVolumeNumber: CON_NATIVE<number>;
        mMarker: CON_NATIVE<number>;
        marker: CON_NATIVE<number>;
        mouseflip: CON_NATIVE<number>;
        statusbarscale: CON_NATIVE<number>;
        drawweapon: CON_NATIVE<number>;
        mouseaiming: CON_NATIVE<number>;
        udWeaponswitch: CON_NATIVE<number>;
        democams: CON_NATIVE<number>;
        color: CON_NATIVE<number>;
        msgdisptime: CON_NATIVE<number>;
        statusbarmode: CON_NATIVE<number>;
        mNoexits: CON_NATIVE<number>;
        noexits: CON_NATIVE<number>;
        autovote: CON_NATIVE<number>;
        automsg: CON_NATIVE<number>;
        idplayers: CON_NATIVE<number>;
        udTeam: CON_NATIVE<number>;
        viewbob: CON_NATIVE<number>;
        weaponsway: CON_NATIVE<number>;
        obituaries: CON_NATIVE<number>;
        levelstats: CON_NATIVE<number>;
        crosshairscale: CON_NATIVE<number>;
        althud: CON_NATIVE<number>;
        displayBonusScreen: CON_NATIVE<number>;
        showLevelText: CON_NATIVE<number>;
        weaponscale: CON_NATIVE<number>;
        textscale: CON_NATIVE<number>;
        runkeyMode: CON_NATIVE<number>;
        mOriginX: CON_NATIVE<number>;
        mOriginY: CON_NATIVE<number>;
        playerbest: CON_NATIVE<number>;
        musictoggle: CON_NATIVE<number>;
        usevoxels: CON_NATIVE<number>;
        usehightile: CON_NATIVE<number>;
        usemodels: CON_NATIVE<number>;
        gametypeflags: CON_NATIVE<number>;
        mGametypeflags: CON_NATIVE<number>;
        globalflags: CON_NATIVE<number>;
        globalgameflags: CON_NATIVE<number>;
        vmPlayer: CON_NATIVE<number>;
        vmSprite: CON_NATIVE<number>;
        vmDistance: CON_NATIVE<number>;
        soundtoggle: CON_NATIVE<number>;
        gametextTracking: CON_NATIVE<number>;
        mgametextTracking: CON_NATIVE<number>;
        menutextTracking: CON_NATIVE<number>;
        maxSpritesOnScreen: CON_NATIVE<number>;
        screenareaX1: CON_NATIVE<number>;
        screenareaY1: CON_NATIVE<number>;
        screenareaX2: CON_NATIVE<number>;
        screenareaY2: CON_NATIVE<number>;
        screenfade: CON_NATIVE<number>;
        menubackground: CON_NATIVE<number>;
        statusbarflags: CON_NATIVE<number>;
        statusbarrange: CON_NATIVE<number>;
        statusbarcustom: CON_NATIVE<number>;
        hudontop: CON_NATIVE<number>;
        menuSlidebarZ: CON_NATIVE<number>;
        menuSlidebarMargin: CON_NATIVE<number>;
        menuSlidecursorZ: CON_NATIVE<number>;
        globalR: CON_NATIVE<number>;
        globalG: CON_NATIVE<number>;
        globalB: CON_NATIVE<number>;
        defaultVolume: CON_NATIVE<number>;
        defaultSkill: CON_NATIVE<number>;
        menuShadeDeselected: CON_NATIVE<number>;
        menuShadeDisabled: CON_NATIVE<number>;
        menutextZoom: CON_NATIVE<number>;
        menutextXspace: CON_NATIVE<number>;
        menutextPal: CON_NATIVE<number>;
        menutextPalselected: CON_NATIVE<number>;
        menutextPaldeselected: CON_NATIVE<number>;
        menutextPaldisabled: CON_NATIVE<number>;
        menutextPalselectedR: CON_NATIVE<number>;
        menutextPaldeselectedR: CON_NATIVE<number>;
        menutextPaldisabledR: CON_NATIVE<number>;
        gametextZoom: CON_NATIVE<number>;
        gametextXspace: CON_NATIVE<number>;
        gametextPal: CON_NATIVE<number>;
        gametextPalselected: CON_NATIVE<number>;
        gametextPaldeselected: CON_NATIVE<number>;
        gametextPaldisabled: CON_NATIVE<number>;
        gametextPalselectedR: CON_NATIVE<number>;
        gametextPaldeselectedR: CON_NATIVE<number>;
        gametextPaldisabledR: CON_NATIVE<number>;
        minitextZoom: CON_NATIVE<number>;
        minitextXspace: CON_NATIVE<number>;
        minitextTracking: CON_NATIVE<number>;
        minitextPal: CON_NATIVE<number>;
        minitextPalselected: CON_NATIVE<number>;
        minitextPaldeselected: CON_NATIVE<number>;
        minitextPaldisabled: CON_NATIVE<number>;
        minitextPalselectedR: CON_NATIVE<number>;
        minitextPaldeselectedR: CON_NATIVE<number>;
        minitextPaldisabledR: CON_NATIVE<number>;
        menutitlePal: CON_NATIVE<number>;
        slidebarPalselected: CON_NATIVE<number>;
        slidebarPaldisabled: CON_NATIVE<number>;
        shadowPal: CON_NATIVE<number>;
        menuScrollbarTilenum: CON_NATIVE<number>;
        menuScrollbarZ: CON_NATIVE<number>;
        menuScrollcursorZ: CON_NATIVE<number>;
        quoteYOffset: CON_NATIVE<number>;
        userByteVersion: CON_NATIVE<number>;
        autosave: CON_NATIVE<number>;
        drawY: CON_NATIVE<number>;
        drawYxaspect: CON_NATIVE<number>;
        fov: CON_NATIVE<number>;
        gamepadactive: CON_NATIVE<number>;
        kickMode: CON_NATIVE<number>;
    }

    /**
     * Read-only tile/texture metadata for a given tile number.
     * Access via `tiledata[picnum].xxx`.
     * All properties are read-only — tile dimensions are engine-managed.
     */
    export interface ITileData {
        /** Tile width in pixels */
        readonly xsize: CON_NATIVE<number>;
        /** Tile height in pixels */
        readonly ysize: CON_NATIVE<number>;
        /** Texture X anchor offset */
        readonly xOffset: CON_NATIVE<number>;
        /** Texture Y anchor offset */
        readonly yOffset: CON_NATIVE<number>;
        /** Number of animation frames */
        readonly animFrames: CON_NATIVE<number>;
        /** Animation playback speed */
        readonly animSpeed: CON_NATIVE<number>;
        /** Animation type (0 = none, 1 = oscillate, 2 = forward loop) */
        readonly animType: CON_NATIVE<number>;
        /** Engine game flags for this tile */
        readonly gameFlags: CON_NATIVE<number>;
        /** Per-tile alpha override (0 = opaque, 255 = transparent) */
        readonly alpha: CON_NATIVE<number>;
        /** Tile dimensions grouped: `x` = xsize, `y` = ysize */
        readonly size: CON_NATIVE<vec2>;
        /** Tile anchor offset grouped: `x` = xOffset, `y` = yOffset */
        readonly offset: CON_NATIVE<vec2>;
    }

    /**
     * Palette metadata for a given palette index.
     * Access via `paldata[palIndex].xxx`. All properties are read-only.
     */
    export interface IPalData {
        /** 1 if this palette is not applied to floor/ceiling surfaces */
        readonly noFloorPal: CON_NATIVE<number>;
    }

    /**
     * Raw player input captured for the current game tic.
     * Indexed by player ID — `input[0]` or `input[THISACTOR]` for the current player.
     * Values reflect button presses and analog movement from the input device.
     */
    export interface IInput {
        /** Forward/backward movement velocity (raw CON name: `fvel`) */
        fvel: CON_NATIVE<number>;
        /** Left/right strafe velocity (raw CON name: `svel`) */
        svel: CON_NATIVE<number>;
        /** Turning angular velocity (raw CON name: `avel`) */
        avel: CON_NATIVE<number>;
        /** Vertical look (horizon) velocity (raw CON name: `horz`) */
        horz: CON_NATIVE<number>;
        /** Bitmask of currently pressed action buttons (raw CON name: `bits`) */
        bits: CON_NATIVE<number>;
        /** Extended button bitmask for additional bindings (raw CON name: `extbits`) */
        extBits: CON_NATIVE<number>;
        /** Forward/backward movement velocity — friendly alias for `fvel` */
        forwardVel: CON_NATIVE<number>;
        /** Left/right strafe velocity — friendly alias for `svel` */
        strafeVel: CON_NATIVE<number>;
        /** Turning angular velocity — friendly alias for `avel` */
        turnVel: CON_NATIVE<number>;
        /** Vertical look (horizon) velocity — friendly alias for `horz` */
        lookUp: CON_NATIVE<number>;
        /** Primary action button bitmask — friendly alias for `bits` */
        buttons: CON_NATIVE<number>;
        /** Extended button bitmask — friendly alias for `extBits` */
        extButtons: CON_NATIVE<number>;
        /** Movement axes grouped: `forward` (fvel), `strafe` (svel), `turn` (avel), `lookUp` (horz) */
        motion: CON_NATIVE<{ forward: number; strafe: number; turn: number; lookUp: number; }>;
        /** Raw fixed-point angular velocity (multiply `avel` by 65536) */
        q16Avel: CON_NATIVE<number>;
        /** Raw fixed-point vertical look (multiply `horz` by 65536) */
        q16Horz: CON_NATIVE<number>;
    }

    export const projectiles: CProjectile[];
    export const tsprites: ITSprite[];
    export const tiledata: ITileData[];
    export const paldata: IPalData[];
    export const userdef: IUserDef[] & IUserDef;
    export const input: IInput[] & IInput;
    /** Shorthand for `players[THISACTOR]` — the player connected to the current actor. Only meaningful inside a `CActor`. */
    export const player: CPlayer;
}