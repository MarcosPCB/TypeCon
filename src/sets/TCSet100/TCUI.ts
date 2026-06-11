import './types';
import { CON_FUNC_ALIAS } from './native';

// Immediate-mode UI layout helper.
//
// To use, import this file in your project:
//   import './include/TCSet100/TCUI';
//
// Configure font and style with setFont()/setStyle() before adding items.
// This is the ImGUI push-style pattern — configure once, then emit items.
//
// Usage inside a display event Append():
//   const ui = new TCUI();            // allocate once, reuse across frames
//   ui.beginContainer(0, 0, 200, 100);
//   ui.setLayout(0, 0, 200, 10, 0);   // vertical, no wrap, 10px row height
//   ui.setFont(2930, 0, 8, 0, 0, ETextFlags.INTERNALSPACE);
//   ui.setStyle(-128, 0, EOrientationFlags.NOCLIP | EOrientationFlags.AUTO);
//   ui.text("Score: " + score);
//   ui.sprite(ICON_TILE, 65536);
//   ui.endContainer();
//
// Layout modes:
//   mode=0  vertical   — items stack top→bottom; cursor advances by ih per item
//   mode=1  horizontal — items go left→right;    cursor advances by iw per item
//
// grow=1: wrap to next row/col when maxPerLine is reached
// grow=0: stop placing items after maxPerLine items

export class TCUI {
    constructor() {}

    // Container bounds (set by beginContainer)
    private cx: number = 0;
    private cy: number = 0;
    private cw: number = 0;
    private ch: number = 0;

    // Layout cursor
    private px: number = 0;
    private py: number = 0;

    // Layout config
    private mode: number = 0;  // 0=vertical, 1=horizontal
    private max: number  = 0;  // max items per row/col (0=unlimited)
    private grow: number = 0;  // 1=wrap, 0=stop at max
    private iw: number   = 0;  // item slot width
    private ih: number   = 0;  // item slot height
    private idx: number  = 0;  // item counter

    // Font settings (stored individually — class methods cannot access IFont fields directly)
    private fontTile: number     = 2930;
    private fontXSpace: number   = 0;
    private fontYLine: number    = 8;
    private fontXBetween: number = 0;
    private fontYBetween: number = 0;
    private fontFlags: number    = 0;

    // Style settings
    private shade: number        = 0;
    private pal: number          = 0;
    private orientation: number  = 0;

    // ── Container ──────────────────────────────────────────────────────────────

    /** Begin a container. Resets cursor to (x, y). All items are clipped to bounds. */
    beginContainer(x: number, y: number, w: number, h: number) {
        this.cx = x;
        this.cy = y;
        this.cw = w;
        this.ch = h;
        this.px = x;
        this.py = y;
        this.idx = 0;
    }

    /** End the container and reset the item counter. */
    endContainer() {
        this.idx = 0;
    }

    // ── Layout ─────────────────────────────────────────────────────────────────

    /**
     * Configure layout for subsequent items.
     * @param mode       0=vertical (items stack down), 1=horizontal (go right)
     * @param maxPerLine wrap/stop after N items (0=unlimited)
     * @param itemW      slot width in pixels (controls cursor advance)
     * @param itemH      slot height in pixels (controls cursor advance)
     * @param grow       1=wrap to next row/col at maxPerLine, 0=stop placing items
     */
    setLayout(mode: number, maxPerLine: number, itemW: number, itemH: number, grow: number) {
        this.mode = mode;
        this.max  = maxPerLine;
        this.iw   = itemW;
        this.ih   = itemH;
        this.grow = grow;
    }

    // ── Font and style ─────────────────────────────────────────────────────────

    /**
     * Set font parameters (mirrors IFont fields).
     * Pass these from an IFont literal:
     *   ui.setFont(myFont.tile, myFont.xSpace, myFont.yLine,
     *              myFont.xBetween, myFont.yBetween, myFont.flags);
     */
    setFont(tile: number, xSpace: number, yLine: number,
            xBetween: number, yBetween: number, flags: number) {
        this.fontTile     = tile;
        this.fontXSpace   = xSpace;
        this.fontYLine    = yLine;
        this.fontXBetween = xBetween;
        this.fontYBetween = yBetween;
        this.fontFlags    = flags;
    }

    /**
     * Set rendering style (mirrors TStyle fields).
     *   ui.setStyle(myStyle.shade, myStyle.pal, myStyle.orientation);
     */
    setStyle(shade: number, pal: number, orientation: number) {
        this.shade       = shade;
        this.pal         = pal;
        this.orientation = orientation;
    }

    // ── Items ──────────────────────────────────────────────────────────────────

    /** Render a single-line string at the cursor position, then advance. */
    text(str: string) {
        if (this.max > 0 && this.grow == 0 && this.idx >= this.max) return;
        const q = Quote(str);
        const ScreenText: CON_FUNC_ALIAS<typeof CEvent.prototype.ScreenText> = CEvent.prototype.ScreenText;
        ScreenText(this.fontTile, this.px, this.py, 65536, 0, 0,
            q, this.shade, this.pal, this.orientation, 0,
            this.fontXSpace, this.fontYLine, this.fontXBetween, this.fontYBetween, this.fontFlags,
            this.cx, this.cy, this.cx + this.cw, this.cy + this.ch);
        this._advance();
    }

    /**
     * Render multi-line text (split on '\n') at the cursor.
     * Advances cursor by (numLines × ih) in vertical mode, one slot in horizontal.
     */
    multilineText(str: string) {
        if (this.max > 0 && this.grow == 0 && this.idx >= this.max) return;
        const lines = str.split('\n');
        const ScreenText: CON_FUNC_ALIAS<typeof CEvent.prototype.ScreenText> = CEvent.prototype.ScreenText;
        lines.forEach((e, i) => {
            const q = Quote(e);
            ScreenText(this.fontTile, this.px, this.py + this.fontYBetween + (this.fontYLine * i), 65536, 0, 0,
                q, this.shade, this.pal, this.orientation, 0,
                this.fontXSpace, this.fontYLine, this.fontXBetween, this.fontYBetween, this.fontFlags,
                this.cx, this.cy, this.cx + this.cw, this.cy + this.ch);
        });
        const totalH = lines.length * this.ih;
        if (this.mode == 0) {
            this.py = this.py + totalH;
        } else {
            this.px = this.px + this.iw;
        }
        this.idx = this.idx + 1;
    }

    /** Render a sprite at the cursor position, then advance. */
    sprite(picnum: number, scale: number) {
        if (this.max > 0 && this.grow == 0 && this.idx >= this.max) return;
        const RotateSprite: CON_FUNC_ALIAS<typeof CEvent.prototype.RotateSprite> = CEvent.prototype.RotateSprite;
        RotateSprite(this.px, this.py, scale, 0, picnum,
            this.shade, this.pal, this.orientation,
            this.cx, this.cy, this.cx + this.cw, this.cy + this.ch);
        this._advance();
    }

    /** Skip n item slots without rendering. */
    spacer(n: number) {
        let i = 0;
        while (i < n) {
            this._advance();
            i = i + 1;
        }
    }

    private _advance() {
        this.idx = this.idx + 1;
        if (this.mode == 1) {
            this.px = this.px + this.iw;
            if (this.max > 0 && this.idx % this.max == 0 && this.grow == 1) {
                this.px = this.cx;
                this.py = this.py + this.ih;
            }
        } else {
            this.py = this.py + this.ih;
            if (this.max > 0 && this.idx % this.max == 0 && this.grow == 1) {
                this.py = this.cy;
                this.px = this.px + this.iw;
            }
        }
    }
}
