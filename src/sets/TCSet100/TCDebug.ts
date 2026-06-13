import './types';
import { TCUI } from './TCUI';
import { CFile, FileReadType } from './CFile';

// Runtime debug overlay and JSON report exporter.
//
// To use, import this file in your project:
//   import './include/TCSet100/TCDebug';
//
// Overlay (live HUD):   setvar TCDEBUG_MODE 1   (EDuke32 console)
//                       tcc make --vars TCDEBUG_MODE=1  (build time)
//
// JSON report (file):   setvar TCPRINT 1   (EDuke32 console)
//   Writes tc_report.json to the EDuke32 working directory in JSON Lines format.
//   Each line is one JSON object (registers, stack values, heap pages).

/** Toggle the debug overlay. Set to 1 via `setvar TCDEBUG_MODE 1`. */
export const TCDEBUG_MODE: gameVar = 0 as gameVar;

/** Set to 1 from the EDuke32 console to export a full JSON report to tc_report.json. */
export const TCPRINT: gameVar = 0 as gameVar;

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

    /**
     * Export a full JSON Lines report to tc_report.json.
     * Called once when TCPRINT is set to 1; the gamevar resets to 0 after writing.
     *
     * JSON Lines format — one JSON object per line:
     *   {"tc_report":"start"}
     *   {"sp":{"rsp":...,"rbp":...,"rds":...}}
     *   {"acc":{"ra":...,"rb":...,"rc":...,"rd":...}}
     *   {"idx":{"ri":...,"rsi":...,"rf":...}}
     *   {"r0_3":{"r0":...,...}}  ...r4_6, r7_10, r11_14, r15_18, r19_23
     *   {"misc":{"rbbp":...,"rssp":...,"rsw":...,"rswc":...}}
     *   {"heap":{"used":...,"free":...,"gc":...}}
     *   {"sv":{"i":N,"v":V}}        ← one line per non-zero stack slot (rbp..rsp)
     *   {"page":{"a":...,"t":...,"s":...}}  ← one per allocated heap page
     *   {"pd":{"a":...,"i":...,"v":...}}    ← one per word of each page's data
     *   {"tc_report":"end"}
     */
    export function PrintReport() {
        // Capture rsp before any allocations — this is the game's stack depth
        // at the moment the report is triggered, matching peakStackPointer in SimReport.
        sysFrame.r0 = 0;
        CONUnsafe(`set r0 rsp`);
        let rspCapture: number = sysFrame.r0;

        // Reserve json slot before complex initialisers (TypeCON rsp rule).
        let json: string = '';

        // ── Root object opener + static fields ───────────────────────────────
        json = '{"timestamp":"0"' +
            ',"source":"runtime"' +
            ',"entryPoint":{"type":"event","id":"EVENT_DISPLAYEND"}' +
            ',"exitCode":0';

        // ── memory.heap stats — iterate allocTable in CONUnsafe ───────────────
        // r0=livePages r1=liveWords r2=markedPages r3=markedWords
        sysFrame.r0 = sysFrame.r1 = sysFrame.r2 = sysFrame.r3 = 0;
        sysFrame.r4 = 0;
        CONUnsafe(`
set r4 heaptables
set rc 0
whilel rc r4 {
    set rd allocTable[rc]
    ifg rd 0 {
        set r5 rd
        and r5 1024
        set r6 blockPages[rc]
        mul r6 4
        ife r5 0 {
            add r0 1
            add r1 r6
        }
        ifn r5 0 {
            add r2 1
            add r3 r6
        }
    }
    add rc 1
}
`);
        let livePages:    number = sysFrame.r0;
        let liveWords:    number = sysFrame.r1;
        let markedPages:  number = sysFrame.r2;
        let markedWords:  number = sysFrame.r3;
        let heapSlots:    number = sysFrame.r4;
        let liveBytes:    number = liveWords   * 4;
        let markedBytes:  number = markedWords * 4;

        json = json + ',"memory":{"stackBase":' + sysFrame.rds +
            ',"stack":{"afterInit":-1,"afterEvents":' + rspCapture + ',"peak":' + rspCapture + '}' +
            ',"heap":{"totalSlots":' + heapSlots +
            ',"live":{"pages":' + livePages + ',"words":' + liveWords + ',"bytes":' + liveBytes + '}' +
            ',"markedToFree":{"pages":' + markedPages + ',"words":' + markedWords + ',"bytes":' + markedBytes + '}' +
            ',"reclaimed":{"pages":0,"words":0,"bytes":0}' +
            '}}';

        json = json + ',"tests":{"ran":false,"total":0,"passed":0,"failed":0,"results":[]}';

        // ── variables: all TypeCON framework gamevars ─────────────────────────
        json = json + ',"variables":{' +
            '"r0":' + sysFrame.r0 + ',"r1":' + sysFrame.r1 + ',"r2":' + sysFrame.r2 +
            ',"r3":' + sysFrame.r3 + ',"r4":' + sysFrame.r4 + ',"r5":' + sysFrame.r5 +
            ',"r6":' + sysFrame.r6;

        sysFrame.r0 = sysFrame.r1 = sysFrame.r2 = sysFrame.r3 = 0;
        CONUnsafe(`set r0 r7\nset r1 r8\nset r2 r9\nset r3 r10`);
        json = json + ',"r7":' + sysFrame.r0 + ',"r8":' + sysFrame.r1 + ',"r9":' + sysFrame.r2 + ',"r10":' + sysFrame.r3;

        sysFrame.r0 = sysFrame.r1 = sysFrame.r2 = sysFrame.r3 = 0;
        CONUnsafe(`set r0 r11\nset r1 r12\nset r2 r13\nset r3 r14`);
        json = json + ',"r11":' + sysFrame.r0 + ',"r12":' + sysFrame.r1 + ',"r13":' + sysFrame.r2 + ',"r14":' + sysFrame.r3;

        sysFrame.r0 = sysFrame.r1 = sysFrame.r2 = sysFrame.r3 = 0;
        CONUnsafe(`set r0 r15\nset r1 r16\nset r2 r17\nset r3 r18`);
        json = json + ',"r15":' + sysFrame.r0 + ',"r16":' + sysFrame.r1 + ',"r17":' + sysFrame.r2 + ',"r18":' + sysFrame.r3;

        sysFrame.r0 = sysFrame.r1 = sysFrame.r2 = sysFrame.r3 = sysFrame.r4 = 0;
        CONUnsafe(`set r0 r19\nset r1 r20\nset r2 r21\nset r3 r22\nset r4 r23`);
        json = json + ',"r19":' + sysFrame.r0 + ',"r20":' + sysFrame.r1 + ',"r21":' + sysFrame.r2 + ',"r22":' + sysFrame.r3 + ',"r23":' + sysFrame.r4;

        json = json + ',"ra":' + sysFrame.ra + ',"rb":' + sysFrame.rb + ',"rc":' + sysFrame.rc +
            ',"rd":' + sysFrame.rd + ',"ri":' + sysFrame.ri + ',"rsi":' + sysFrame.rsi +
            ',"rf":' + sysFrame.rf + ',"rsp":' + rspCapture + ',"rbp":' + sysFrame.rbp +
            ',"rds":' + sysFrame.rds;

        sysFrame.r0 = sysFrame.r1 = sysFrame.r2 = sysFrame.r3 = 0;
        CONUnsafe(`set r0 rbbp\nset r1 rssp\nset r2 rsw\nset r3 rswc`);
        json = json + ',"rbbp":' + sysFrame.r0 + ',"rssp":' + sysFrame.r1 + ',"rsw":' + sysFrame.r2 + ',"rswc":' + sysFrame.r3;

        sysFrame.r0 = sysFrame.r1 = sysFrame.r2 = sysFrame.r3 = 0;
        CONUnsafe(`set r0 rfx0\nset r1 rfx1\nset r2 rfx2\nset r3 rfx3`);
        json = json + ',"rfx0":' + sysFrame.r0 + ',"rfx1":' + sysFrame.r1 + ',"rfx2":' + sysFrame.r2 + ',"rfx3":' + sysFrame.r3;

        sysFrame.r0 = sysFrame.r1 = 0;
        CONUnsafe(`set r0 heaptables\nset r1 heapsize`);
        json = json + ',"heaptables":' + sysFrame.r0 + ',"heapsize":' + sysFrame.r1 + ',"PAGE_SIZE":4}';

        json = json + ',"actorFields":{}';

        // GC before the big flatMemory sections.
        CONUnsafe(`
set r12 rsp
set rsp rbp
add rsp 16
state _GC
set rsp r12
`);

        // ── flatMemory.stack: flat[0..rspCapture] ─────────────────────────────
        sysFrame.r0 = 0;
        sysFrame.r1 = 0;
        CONUnsafe(`set r1 flat[r0]`);
        json = json + ',"flatMemory":{"stackBase":' + sysFrame.rds +
            ',"peakStackPointer":' + rspCapture +
            ',"stack":[' + sysFrame.r1;

        let si: number = 1;
        while (si <= rspCapture) {
            sysFrame.r0 = si;
            sysFrame.r1 = 0;
            CONUnsafe(`set r1 flat[r0]`);
            json = json + ',' + sysFrame.r1;
            si = si + 1;
        }
        json = json + ']';

        // GC between stack dump and heap pages.
        CONUnsafe(`
set r12 rsp
set rsp rbp
add rsp 16
state _GC
set rsp r12
`);

        // ── flatMemory.heapPages: all allocated pages with data ───────────────
        // Physical-page allocator: address = stackBase + pageIdx * PAGE_SIZE.
        // blockPages[i] gives the page count for the block starting at i.
        // All locals declared before the if so TypeCON's rsp stays balanced.
        json = json + ',"heapPages":[';
        let pageIdx:   number = 0;
        let keepGoing: number = 1;
        let firstPage: number = 1;
        while (keepGoing == 1) {
            sysFrame.r0 = pageIdx;
            sysFrame.r1 = sysFrame.r2 = sysFrame.r3 = sysFrame.r4 = 0;
            CONUnsafe(`
ifvarl r0 heaptables {
    set r1 allocTable[r0]
    set r2 r0
    mul r2 4
    add r2 8192
    set r3 blockPages[r0]
    set r4 1
}
`);
            if (sysFrame.r4 == 0) {
                keepGoing = 0;
            } else {
                // 7 locals here: TypeCON balance requires identical count in both
                // if (rawType != 0) branches — no let inside the inner if.
                // typeLabel is built inline into json to avoid a heap string alloc
                // per free-page iteration.
                // 6 locals — ALL declared here so both branches of if(rawType!=0)
                // have the same stack depth. No data-loop variables needed since
                // data output is an empty array.
                let rawType:   number = sysFrame.r1;
                let addr:      number = sysFrame.r2;
                let numPages:  number = sysFrame.r3;
                let sizeWords: number = 0;
                let baseType:  number = 0;
                let mkBit:     number = 0;

                if (rawType != 0) {
                    sizeWords = numPages * 4;

                    sysFrame.r0 = rawType;
                    CONUnsafe(`and r0 1024`);
                    mkBit = sysFrame.r0;
                    sysFrame.r0 = rawType;
                    CONUnsafe(`and r0 -1025`);
                    baseType = sysFrame.r0;

                    // Page separator
                    if (firstPage == 1) {
                        firstPage = 0;
                    } else {
                        json = json + ',';
                    }

                    // Build "typeLabel" inline into json — no intermediate string alloc
                    json = json + '{"address":' + addr + ',"type":' + rawType + ',"typeLabel":"';
                    if (mkBit != 0)     { json = json + 'marked:'; }
                    if (baseType == 1)  { json = json + 'array'; }
                    if (baseType == 2)  { json = json + 'string'; }
                    if (baseType == 4)  { json = json + 'object'; }
                    if (baseType == 8)  { json = json + 'string_array'; }
                    if (baseType == 16) { json = json + 'peractor'; }
                    // Data: empty array — outputting raw words via repeated string
                    // concat causes exponential copy-realloc blowup in the VM sim
                    // (each word concat re-scans the full heap page table, O(N^2) total).
                    // In real EDuke32 there are no step limits; data can be added there.
                    json = json + '","sizeWords":' + sizeWords + ',"data":[]}';

                    // GC after each live page: the metadata output creates orphaned
                    // number strings that the loop would otherwise encounter as new
                    // live pages, causing an exponential cascade of processing.
                    CONUnsafe(`
set r12 rsp
set rsp rbp
add rsp 24
state _GC
set rsp r12
`);
                }
                pageIdx = pageIdx + 1;
            }
        }

        json = json + ']}}';

        // ── Write to tc_report.json via rstack + writearraytofile ────────────
        sysFrame.r0 = json as any as number;
        CONUnsafe(`
state pushr12
set r1 flat[r0]     // r1 = string length
add r0 1            // r0 = pointer to first char

// Pad string length up to the next 4-byte boundary with spaces (0x20).
// writearraytofile writes full 32-bit words; without padding the last word
// would contain zero bytes which are not valid in JSON files.
set r8 r1
mod r8 4
ifn r8 0 {
    set r9 4
    sub r9 r8           // r9 = spaces needed (1–3)

    // Ensure flat[] is large enough for the padding bytes + null terminator.
    // When the json string exactly fills its heap page(s), ri = r0+r1 would
    // equal the current flat size — writing padding there triggers an OOB write.
    set ri r0
    add ri r1           // ri = position just past last char (= first padding slot)
    set r10 ri
    add r10 r9          // r10 = null terminator position
    add r10 1           // r10 = null terminator position + 1 (exclusive upper bound)
    getarraysize flat r11
    ifge r10 r11 {
        resizearray flat r10   // grow flat to accommodate padding + null
    }

    whilen r9 0 {
        setarray flat[ri] 32   // write space (0x20)
        add ri 1
        add r1 1
        sub r9 1
    }
    setarray flat[ri] 0        // re-null-terminate
}

set r2 r1
add r2 3
div r2 4
getarraysize rstack rd
resizearray rstack r2
set r3 0
set r4 0
set r5 0
set r6 0
whilel r3 r1 {
    set r7 r0
    add r7 r3
    set r7 flat[r7]
    ife r7 0
        exit
    shiftl r7 r6
    or r5 r7
    add r6 8
    ife r6 32 {
        setarray rstack[r4] r5
        add r4 1
        set r5 0
        set r6 0
    }
    add r3 1
}
ifn r5 0 {
    setarray rstack[r4] r5
}
qputs 1021 tc_report.json
writearraytofile rstack 1021
resizearray rstack rd
state popr12
`);

        console.log('[TCDebug] Report saved: tc_report.json');
    }
}

// Self-hooking event handler — runs last in the display pipeline.
class _TCDebugHUD extends CEvent {
    constructor() { super('DisplayEnd'); }
    Append() {
        TCDebug.ShowDebugInfo();
        if (TCPRINT != 0) {
            TCDebug.PrintReport();
            CONUnsafe(`set TCPRINT 0`);  // reset — gameVar is mutable at CON level
        }
    }
}
