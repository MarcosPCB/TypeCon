import { CON_CONSTANT, CON_NATIVE, CON_NATIVE_GAMEVAR, CON_NATIVE_OBJECT, CON_NATIVE_POINTER, CON_NATIVE_STATE } from "./native"

//@typecon

namespace nocompile { }

declare global {
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
     * quote type. In TypeCON, we have strings, which are kept inside the flat memory and can be converted
     * and then we have quotes, which are kept separately from the memory and are used in native CON commands.
     * quotes have a 128 character limitation.
     */
    export type quote = string & { _brand: 'quote' };

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
        /** The current velocity */
        public vel: CON_NATIVE<number>;
        /** The current actor's angle */
        public ang: CON_NATIVE<number>;
        /** The current position */
        public pos: CON_NATIVE<vec3>;
        /** The current AI pointer */
        public curAI: CON_NATIVE<number>;
        /** The current palette used by the actor */
        public pal: CON_NATIVE<number>;
        /** The current sector object */
        public curSector: CON_NATIVE<CSector>;
        /** The current sector ID */
        public curSectorID: CON_NATIVE<number>;
        /** The special flags active for the sprite */
        public flags: CON_NATIVE<number>;
        /** The Lotag and Hitag of the sprite */
        public tags: CON_NATIVE<tag>;

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
        public Sound(sound_id: number, global?: boolean, once?: boolean): CON_NATIVE<void>
        /**
         * Stops playing a sound
         * @param sound_id - the sound ID
         */
        public StopSound(sound_id: number): CON_NATIVE<void>
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
         * @todo no implemented yet
         * Calculates the angle necessary for the current sprite to face whatever target is
         * or was at the coordinates htlastvx and htlastvy.
         */
        public AngleToTarget(): CON_NATIVE<number>

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

    export type TEventPAE = 'Game' | 'EGS' | 'Spawn' | 'KillIt' | 'PreGame' | 'PreActorDamage' | 'AnimateSprites' | 'RecogSound';
    export type TEventDE = 'DisplayRest' | 'DisplayStart' | 'DisplayEnd';
    export type TEvents = TEventPAE | TEventDE;

    export type OnEvent = Partial<{
        [E in TEventPAE]: (
            this: CEvent & CActor
        ) => void | number;
    }>;

    export type OnVariation<C extends CActor> = Record<string, {
        (this: C): {
            picnum: constant,
            extra: constant,
            first_action?: IAction
        };
    }>

    /** @class for declaring events. Use this as extension. */
    export class CEvent {
        /** @todo */
        protected argument?: number | number[];

        /**
         * Starts the event declaration
         * @param event - the event that will be defined. See {@link TEvents}
         */
        constructor(event: TEvents)

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
        public ScreenSound(sound: number): CON_NATIVE<void>;
        public ScreenText(picnum: number, x: number, y: number, scale: number, block_ang: number, character_ang: number, quote: quote, shade: number, pal: number, orientation: number, alpha: number, xspace: number, yline: number, xbetween: number, ybetween: number, flags: number, x0: number, y0: number, x1: number, y1: number): CON_NATIVE<void>;

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

    export interface CSectorBase {
        z: CON_NATIVE<number>;
        picnum: CON_NATIVE<number>;
        slope: CON_NATIVE<number>;
        shade: CON_NATIVE<number>;
        pal: CON_NATIVE<number>;
        xPan: CON_NATIVE<number>;
        yPan: CON_NATIVE<number>;
        zGoal: CON_NATIVE<number>;
        bunch: CON_NATIVE<number>;
        stat: CON_NATIVE<number>;
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
        public next: { wall: CWall, sector: CSector };
    }

    export class CSector {
        public wallPtr: CON_NATIVE<number>;
        public wallNum: CON_NATIVE<number>;

        public ceiling: CON_NATIVE<CSectorBase>;
        public floor: CON_NATIVE<CSectorBase>;

        public visibility: CON_NATIVE<number>;
        public fogPal: CON_NATIVE<number>;

        public tags: CON_NATIVE<tag>;

        public extra: CON_NATIVE<number>;

        public firstWall: CWall;
        public walls: CWall[];
    }

    export const sectors: CSector[];

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
        GLOWS               = 2,
        AUTOMATIC           = 4,
        FIREEVERYOTHER      = 8,
        FIREEVERYTHIRD      = 16,
        RANDOMRESTART       = 32,
        AMMOPERSHOT         = 64,
        BOMB_TRIGGER        = 128,
        NOVISIBLE           = 256,
        THROWIT             = 512,
        CHECKATRELOAD       = 1024,
        STANDSTILL          = 2048,
        SPAWNTYPE2          = 4096,
        SPAWNTYPE3          = 8192,
        SEMIAUTO            = 16384,
        RELOAD_TIMING       = 32768,
        RESET               = 65536,
    }

    export class CWeaponNative {
        /** True if it's secondary to any ID from 0 - 10 */
        public subWeapon: CON_NATIVE<boolean>;
        /** 
         * The flags for the weapon (does not control the projectile)
         * @see {@link EWeaponFlags}
         */
        public flags: CON_NATIVE<number>;

        /** 
         * It's the amount of ammo that can be fired before there is a reloading animation and pause.
         * If you want to disable the reloading, set {@link clip} to 0. 
         * */
        public clip: CON_NATIVE<number>;
        /** 
         * Defines the number of frames displayed in the weapon's reload sequence,
         * in a similar vein to {@link totalTime}. If {@link clip} is zero, this sequence takes place after every shot.
         * If non-zero, it takes place when the remainder of the weapon's current ammo divided by {@link clip} is zero.
         * The {@link hudCounter} values increase to a weapon's {@link totalTime} plus its {@link reload}. */
        public reload: CON_NATIVE<number>;

        /** Defines what frame the weapon will fire it's projectile on. */
        public fireDelay: CON_NATIVE<number>;
        /**
         * The number of animation frames between shooting and reloading. 
         * @see **Note**: If {@link flags} has {@link EWeaponFlags.RESET} set on the weapon
         * and {@link hudCounter} is greater than {@link totalTime} - holdDelay,
         * then {@link hudCounter} is set to either 1 or 0 depending on whether the fire key is still held.
         */
        public holdDelay: CON_NATIVE<number>;
        /** Defines the total number of frames a weapon uses in its firing sequence. */
        public totalTime: CON_NATIVE<number>;

        public flashColor: CON_NATIVE<number>;

        /** This is the tilenum of the projectile */
        public shoots: CON_NATIVE<number>;
        /** 
         * Defines the amount of projectiles (which itself is defined by {@link shoots})
         * that will fire when the weapon reaches it's firing frame.
         */
        public shotsPerBurst: CON_NATIVE<number>;

        /**
         * This defines what the weapon spawns when the {@link spawnTime} is reached.
         * Used in the default weapons to spawn empty shells.
         * To spawn nothing, set to 0.
         */
        public spawn: CON_NATIVE<number>;
        /**
         * Defines what frame the item specified by {@link spawn} will spawn on.
         */
        public spawnTime: CON_NATIVE<number>;

        /**
         * If {@link EWeaponFlags.RELOAD_TIMING} is enabled in the {@link flags} bitfield,
         * reloadSound1 is the first sound to be played in the weapon's reload sequence. {@link reloadSound2} is the second.
         * All weapons have this value set to **EJECT_CLIP** by default but only
         * WEAPON 1 (the pistol) utilizes it.
         */
        public reloadSound1: CON_NATIVE<number>;
        /**
         * If {@link EWeaponFlags.RELOAD_TIMING} is enabled in the {@link flags} bitfield,
         * reloadSound2 is the second sound to be played in the weapon's reload sequence. {@link reloadSound1} is the first.
         * All weapons have this value set to **INSERT_CLIP** by default but only
         * WEAPON 1 (the pistol) utilizes it.
         */
        public reloadSound2: CON_NATIVE<number>;
        /** The sound played when a weapon is selected. */
        public selectSound: CON_NATIVE<number>;
        /** 
         * Plays the corresponding sound when the {@link hudCounter} reaches
         * the number specified by {@link fireDelay}
         */
        public fireSound: CON_NATIVE<number>;
        /**
         * Defines the sound that will play when the player starts to fire the weapon
         * **(NOT the sound that will play when the weapon actually fires its projectile**
         * that is controlled by {@link fireSound})
         * @see {@link fireSound}
         */
        public initialSound: CON_NATIVE<number>;
        /**
         * This is the weapon's second sound.
         * It starts on the frame number defined with {@link sound2Time}.
         */
        public sound2Sound: CON_NATIVE<number>;
        /**
         * If the weapon has a second shooting sound defined in {@link sound2Sound} like the shotgun,
         * this is the frame number for the second sound to start.
         */
        public sound2Time: CON_NATIVE<number>;

        /**
         * Determines random Z vellocity adjustment on hitscan weapons fired from player.
         * By default, hitscan projectiles (i.e. instant hit bullet projectiles such as **SHOTSPARK1**)
         * do not have perfect aim; there is a random component to their trajectories.
         * zRange is the Z part of this random component.
         * zRange can be adjusted in GetShotRange event or in the method {@link GetShotRange}.
         * When zRange is set to 1, the hitscan projectile will fire with perfect Z axis accuracy.
         * Increase {@link angleRange} by powers of 2 (2, 4, etc.) to increase the random angle and decrease accuracy.
         * @see {@link angleRange}
         */
        public zRange: CON_NATIVE<number>;
        /** Determines random angle adjustment on hitscan weapons fired from player.
         * @see {@link zRange}
         */
        public angleRange: CON_NATIVE<number>;
        /**
         * This determines the horizontal range (a cone from 0-512 * 2, with the center being the player's current angle)
         * at which shots will automatically lock onto enemies when autoaim is active.
         * This variable must be set inside GetAutoAimAng or in the method {@link autoAimAngle} to take effect.
         * The default is 48. Set it to 0 to disable autoaim, or to 512 for a full 180 degree autoaim in front of the player.
         * 
         * @see {@link autoAimAngle}
         */
        public autoAimAngle: CON_NATIVE<number>;

        /** Gets/Sets the maximum ammo for this weapon */
        public MaxAmmo(amount: number): CON_NATIVE<number>;
         /** Gets/Sets the current ammo for this weapon */
        public CurrentAmmo(amount: number): CON_NATIVE<number>;
        /** Gets/Sets how much ammo is used per-shot fired */
        public AmmoDiscount(amount: number): CON_NATIVE<number>;

        /** The frame counter for the weapon. Use this to draw the weapon psrite in {@link DrawHUD}
         * or change its value whenever you need to make awesome effects.
         * **Note**: When set to 1, it starts the firing animation until it reaches {@link totalTime}
         * @default true
         * @see {@link totalTime}
         * */
        public hudCounter: CON_NATIVE<number>;

        /**
         * Set this to **false** to disable sway effects applied automatically to the sprite drawing
         * @default true
         * @see {@link weapon_xoffset}
         * @see {@link gunPos}
         */
        public SwayEffect: CON_NATIVE<boolean>;

        /**
         * Set this to properly initialize the weapon the way you want it to work.
         *
         * @param config - The initial configuration for the weapon (applied when called in the WeapXKey event — X is the weapon’s corresponding key number)
         */
        constructor(config: {
            /** The weapon ID (0 – 11) */
            id: constant;
        
            /** True if it’s secondary to any ID from 0 – 10 */
            subWeapon: boolean;
        
            /**
             * The flags for the weapon (does not control the projectile)
             * @see {@link EWeaponFlags}
             */
            flags?: constant;
        
            /**
             * Amount of ammo that can be fired before a reload animation and pause.
             * Set to 0 to disable reloading.
             */
            clip?: constant;
        
            /**
             * Number of frames in the weapon’s reload sequence.
             * If clip is 0, runs after every shot; otherwise when current ammo % clip === 0.
             */
            reload?: constant;
        
            /** Frame at which the weapon fires its projectile */
            fireDelay?: constant;
        
            /**
             * Frames between shooting and reloading.
             * If flags includes {@link EWeaponFlags.RESET} and internal counter > totalTime – holdDelay,
             * the counter resets to 1 or 0 depending on whether fire is still held.
             */
            holdDelay?: constant;
        
            /** Total number of frames in the weapon’s firing sequence */
            totalTime?: constant;
        
            /** Color index used for the muzzle flash */
            flashColor?: constant;
        
            /** Tile number of the projectile */
            shoots?: constant;
        
            /**
             * Number of projectiles (tile = shoots) fired when reaching the firing frame
             */
            shotsPerBurst?: constant;
        
            /**
             * Tile number to spawn when spawnTime is reached (e.g. empty shells).
             * Set to 0 to spawn nothing.
             */
            spawn?: constant;
        
            /** Frame at which the item in spawn appears */
            spawnTime?: constant;
        
            /**
             * First sound in the reload sequence when {@link EWeaponFlags.RELOAD_TIMING} is set.
             * Defaults to EJECT_CLIP; only pistol uses it.
             */
            reloadSound1?: constant;
        
            /**
             * Second sound in the reload sequence when {@link EWeaponFlags.RELOAD_TIMING} is set.
             * Defaults to INSERT_CLIP; only pistol uses it.
             */
            reloadSound2?: constant;
        
            /** Sound played when the weapon is selected */
            selectSound?: constant;
        
            /** Sound played when internal counter reaches fireDelay */
            fireSound?: constant;
        
            /**
             * Sound played when the player starts to fire the weapon
             * (not the projectile sound; see {@link fireSound})
             */
            initialSound?: constant;
        
            /** Secondary firing sound (e.g. shotgun’s second blast) */
            sound2Sound?: constant;
        
            /** Frame at which sound2Sound begins */
            sound2Time?: constant;
        
            /**
             * Random Z‐velocity adjustment for hitscan weapons.
             * 1 = perfect Z accuracy; increase angleRange by powers of 2 to reduce accuracy.
             */
            zRange?: constant;
        
            /** Random angle adjustment for hitscan weapons (@see {@link zRange}) */
            angleRange?: constant;
        
            /**
             * Horizontal auto‐aim cone (0–1024; center = player angle).
             * Set to 0 to disable, 512 for full 180° front auto‐aim.
             */
            autoAimAngle?: constant;
        
            /** Maximum ammo capacity for this weapon */
            maxAmmo: constant;
        
            /** Ammo consumed per shot */
            ammoDiscount?: constant;
        
            /**
             * If subWeapon is true and this is true, secondary uses the same ammo pool as primary
             */
            ammoShared?: boolean;
        });
  

        /**
         * Drawing routine for the weapon sprite (use {@link hudCounter} to get which frame is the current one)
         * @see {@link hudCounter}
         */
        public DrawHUD(): CON_NATIVE<void>;
        /**
         * This functions is called whenever you press the number key associated with this weapon
         * (weapon ID + 1 with the exception of weapon 11 which is a sub of weapon 6)
         */
        public NumberKey(): CON_NATIVE<void>;
        /**
         * This function is called if you successfully fire the weapon
         * @see {@link fireDelay}
         */
        public DoFire(): CON_NATIVE<void>;
        /**
         * This is called whenever you press the fire key
         */
        public FireKey(): CON_NATIVE<void>;
        /**
         * This gets called when the weapon is firing and the key is held
         */
        public FireKeyHeld(): CON_NATIVE<void>;
        /**
         * Called IF the projectile is a hitscan. Use this to control the zRange and AngleRange properties.
         */
        public GetShotRange(): CON_NATIVE<void>;
        /**
         * Called when the Auto Aim is active and the projectile gets fired
         */
        public GetAutoAimAngle(): CON_NATIVE<void>;
        /**
         * This functions is called when the weapon is changing.
         */
        public Changing(): CON_NATIVE<void>;
        /**
         * This is called when you sucessfully selects this weapon
         */
        public Select(): CON_NATIVE<void>;
        /**
         * Called whenever the weapon must be reset
         */
        public Reset(): CON_NATIVE<void>;
    }

    /**
     * Holds the native weapons' configuration
     * **Note**: available slots are 0 - 11
     */
    export const weapons: CWeaponNative[];
}