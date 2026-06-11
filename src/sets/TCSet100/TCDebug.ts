import './types';
import { TCUI } from './TCUI';

// Runtime debug overlay — renders stack and heap stats at the top of the screen.
//
// To use, import this file in your project:
//   import './include/TCSet100/TCDebug';
//
// Toggle from the EDuke32 console:  setvar TCDEBUG_MODE 1
// Toggle at build time:             tcc make --vars TCDEBUG_MODE=1
//
// Importing this file self-hooks EVENT_DISPLAYEND automatically.
// No manual wiring needed.
//
// The overlay shows:
//   Stack: current rsp vs max (rds)
//   Heap:  allocated / free / marked-to-free page counts

/** Toggle the debug overlay. Set to 1 via `setvar TCDEBUG_MODE 1` in the EDuke32 console. */
export const TCDEBUG_MODE: gameVar = 0 as gameVar;

export namespace TCDebug {
    // flat[] globals for per-frame heap page counts
    let _freePages: number = 0;
    let _usedPages: number = 0;
    let _markedPages: number = 0;

    // Iterate allocTable to count page states.
    //   allocTable[i] == 0  → free
    //   allocTable[i] >  0  → allocated
    //   allocTable[i] <  0  → marked to free (pending GC)
    function _countHeapPages() {
        sysFrame.r0 = sysFrame.r1 = sysFrame.r2 = 0;

        CONUnsafe(`
set rc 0
whilel rc heaptables {
    ife allocTable[rc] 0 {
        add r0 1
    }
    ifl allocTable[rc] 0 {
        add r1 1
    }
    ifg allocTable[rc] 0 {
        add r2 1
    }
    add rc 1
}
`);

        _freePages = sysFrame.r0;
        _markedPages = sysFrame.r1;
        _usedPages = sysFrame.r2;
    }

    /**
     * Render the debug overlay for the current frame.
     * Called automatically by the self-hooked EVENT_DISPLAYEND handler.
     * You can also call this manually from your own display event if needed.
     */
    export function ShowDebugInfo() {
        if (TCDEBUG_MODE == 0) return;

        _countHeapPages();

        let stackStr: string = "Stack: " + sysFrame.rsp + " / " + sysFrame.rds;
        let heapStr: string  = "Heap:  used=" + _usedPages
            + " free=" + _freePages
            + " gc=" + _markedPages;

        const ui = new TCUI();
        ui.beginContainer(2, 2, 316, 20);
        ui.setLayout(0, 0, 316, 9, 0);
        ui.setFont(2930, 0, 8, 0, 0, ETextFlags.INTERNALSPACE);
        ui.setStyle(-128, 0, EOrientationFlags.NOCLIP | EOrientationFlags.AUTO);
        ui.multilineText(stackStr + "\n" + heapStr);
        ui.endContainer();
    }
}

// Self-hooking event handler — runs last in the display pipeline so the overlay
// renders on top of everything. CEvent subclasses self-register; no instantiation needed.
class _TCDebugHUD extends CEvent {
    constructor() { super('DisplayEnd'); }
    Append() { TCDebug.ShowDebugInfo(); }
}
