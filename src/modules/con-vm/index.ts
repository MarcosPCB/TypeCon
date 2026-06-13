import { CONParser } from './Parser';
import { createVMState, resetPhasePeaks, takeSnapshot, VMState, TestResult, setStructField } from './Memory';
import { executeStatements, TerminateSignal, ExitStateSignal, BreakSignal } from './Interpreter';
import * as fs from 'fs';
import * as path from 'path';

export interface VMRunOptions {
  entryState?: string;  // --state NAME: run a specific defstate
  entryEvent?: string;  // --event NAME: run a specific event body directly (e.g. EVENT_SPAWN)
  entryActor?: string;  // --actor PICNUM: run a specific actor/useractor body directly
  noInit?: boolean;     // skip EVENT_INIT → EVENT_INITCOMPLETE → EVENT_SETDEFAULTS → EVENT_NEWGAME preamble
  showMemory?: boolean; // print memory usage report after simulation
  testMode?: boolean;   // print structured pass/fail summary and return exit code
  twoPassGC?: boolean;        // run GC twice after entry point (completes two-pass deferred deletion)
  strictIntegers?: boolean;   // throw if NaN or decimal values are written to a CON variable
  sourceFile?: string;        // original .con file path — included in the JSON report
  searchDirs?: string[]; // directories to search for include files (CON dir, baseCON, …)
  // Pre-seed game structure fields before simulation (index → field → value)
  actorFieldOverrides?:  Map<number, Map<string, number>>;
  playerFieldOverrides?: Map<number, Map<string, number>>;
  sectorFieldOverrides?: Map<number, Map<string, number>>;
  wallFieldOverrides?:   Map<number, Map<string, number>>;
  // Override gamevar initial values before simulation begins
  gamevarOverrides?: Map<string, number>;
}

export interface HeapStats {
  pages: number;
  words: number;
  bytes: number;
}

export interface SimReport {
  timestamp:  string;
  source:     string;
  entryPoint: { type: 'state' | 'event' | 'actor' | 'default'; id?: string };
  exitCode:   number;
  memory: {
    stackBase:  number;
    stack: { afterInit: number; afterEvents: number; peak: number };
    heap: {
      totalSlots:   number;
      live:         HeapStats;
      markedToFree: HeapStats;
      reclaimed:    HeapStats;
    };
  };
  tests: {
    ran:     boolean;
    total:   number;
    passed:  number;
    failed:  number;
    results: Array<{ name: string; total: number; passed: number }>;
  };
  variables:   Record<string, number>;
  actorFields: Record<number, Record<string, number>>;
  flatMemory: {
    stackBase:          number;   // rds — boundary between stack and heap
    peakStackPointer:   number;   // highest rsp reached
    stack:              number[]; // flat[0..peakRsp] — the used stack region
    heapPages: Array<{
      address:   number;  // flat[] index where this page starts
      type:      number;  // raw allocTable type flags
      typeLabel: string;  // human-readable: "array" | "string" | "object" | "peractor" | "marked"
      sizeWords: number;
      data:      number[]; // flat[address..address+sizeWords-1]
    }>;
  };
}

export interface VMRunResult {
  exitCode: number; // 0 = all tests passed (or no tests), 1 = failures
  // Final VM state — exposed for post-simulation assertions in tcc test
  vars:         Map<string, number>;
  actorFields:  Map<number, Map<string, number>>;
  playerFields: Map<number, Map<string, number>>;
  sectorFields: Map<number, Map<string, number>>;
  wallFields:   Map<number, Map<string, number>>;
  report?:      SimReport; // populated when showMemory or twoPassGC is requested
}

function stateResult(exitCode: number, state: VMState): VMRunResult {
  return { exitCode, vars: state.vars, actorFields: state.actorFields,
           playerFields: state.playerFields, sectorFields: state.sectorFields,
           wallFields: state.wallFields };
}

function emptyResult(exitCode: number): VMRunResult {
  return { exitCode, vars: new Map(), actorFields: new Map(),
           playerFields: new Map(), sectorFields: new Map(), wallFields: new Map() };
}

// Default event run order when no --state is provided
// Keys are stored uppercased to match CON's case-insensitive identifiers
const DEFAULT_EVENTS = [
  'EVENT_INIT',
  'EVENT_INITCOMPLETE',
  'EVENT_SETDEFAULTS',
  'EVENT_NEWGAME',
];

export function runVM(source: string, opts: VMRunOptions = {}): VMRunResult {
  const searchDirs = opts.searchDirs ?? [];

  // Auto-load baseCON/GAME.CON if it exists in any search directory and the
  // main source doesn't already include it. This makes standard game states
  // (jib_sounds, drop_ammo, standard_jibs, etc.) available even for
  // TypeCON-generated CON files that have no explicit include directives.
  let effectiveSource = source;
  const sourceLower = source.toLowerCase();
  const alreadyIncludesGame = /\binclude\s+game\.con\b/i.test(sourceLower);
  if (!alreadyIncludesGame && searchDirs.length > 0) {
    for (const dir of searchDirs) {
      if (fs.existsSync(path.join(dir, 'GAME.CON'))) {
        effectiveSource = 'include GAME.CON\n' + source;
        break;
      }
    }
  }

  const parser = new CONParser(effectiveSource, searchDirs);
  const { stateMap, defines, initStatements, eventBodies, actorBodies, actorHeaders } = parser.parse();

  const state = createVMState();
  state.defines = defines;
  state.strictIntegers = opts.strictIntegers ?? false;

  // Auto-apply actor header values (extra, etc.) when running with --actor
  // Done before CLI overrides so that --set-field-actor takes precedence
  if (opts.entryActor) {
    const header = actorHeaders.get(opts.entryActor);
    if (header) {
      if (header.extra !== 0) setStructField(state.actorFields, state.thisactor, 'extra', header.extra);
      const parts: string[] = [`extra=${header.extra}`];
      if (header.firstAction) parts.push(`action=${header.firstAction}`);
      if (header.firstMove)   parts.push(`move=${header.firstMove}`);
      if (header.flags !== 0) parts.push(`flags=${header.flags}`);
      console.log(`[CONVM] Actor ${opts.entryActor} header: ${parts.join(', ')}`);
    }
  }

  // Apply game structure field overrides from CLI flags
  if (opts.actorFieldOverrides)  mergeStructFields(state.actorFields,  opts.actorFieldOverrides);
  if (opts.playerFieldOverrides) mergeStructFields(state.playerFields, opts.playerFieldOverrides);
  if (opts.sectorFieldOverrides) mergeStructFields(state.sectorFields, opts.sectorFieldOverrides);
  if (opts.wallFieldOverrides)   mergeStructFields(state.wallFields,   opts.wallFieldOverrides);
  // Expose THISACTOR / THISPLAYER as vars so geta[THISACTOR].field resolves correctly
  state.vars.set('THISACTOR',  state.thisactor);
  state.vars.set('THISPLAYER', state.thisplayer);

  // Initialise declared arrays and non-zero gamevar defaults
  for (const [key, body] of stateMap) {
    if (key.startsWith('__array_') || key.startsWith('__var_')) {
      try { executeStatements(body, state, stateMap); } catch (_) {}
    }
  }

  function runSafe(body: Statement[], label?: string) {
    const isTest = body.length > 0 && body[0].op === 'marker' && (body[0] as any).name === 'DEBUG-TEST';
    try { executeStatements(body, state, stateMap); }
    catch (e) {
      if (e instanceof TerminateSignal || e instanceof ExitStateSignal || e instanceof BreakSignal) return;
      throw e;
    }
    if (isTest && opts.testMode) {
      const rb = state.vars.get('rb') ?? 0;
      const total = rb >>> 12;
      const passed = rb & 0xFFF;
      state.testResults.push({ stateName: label ?? 'anonymous', total, passed });
    }
  }

  // Phase 1: init statements
  resetPhasePeaks(state);
  runSafe(initStatements);

  // Set stack overflow limit from rds (= stackSize + globalStaticSize) now that init has run
  const rds = state.vars.get('rds');
  if (rds !== undefined) state.stackLimit = rds;

  // Snapshot 1: after init statements (starting baseline)
  state.snapAfterInit = takeSnapshot(state);

  if (opts.entryState || opts.entryEvent || opts.entryActor) {
    // Phase 2: game-lifecycle events (bootstrap)
    resetPhasePeaks(state);
    if (!opts.noInit) {
      for (const ev of DEFAULT_EVENTS) {
        const body = eventBodies.get(ev);
        if (body) { runSafe(body, ev); }
      }
    }
    // Snapshot 2: after init events, before entry point
    state.snapAfterEvents = takeSnapshot(state);

    // Apply gamevar overrides between bootstrap and entry point
    if (opts.gamevarOverrides) {
      for (const [name, value] of opts.gamevarOverrides) {
        state.vars.set(name, value);
      }
    }

    // Phase 3: run the requested entry point
    resetPhasePeaks(state);
    if (opts.entryState) {
      const body = stateMap.get(opts.entryState);
      if (!body) {
        console.error(`[CONVM] State '${opts.entryState}' not found`);
        return emptyResult(1);
      }
      runSafe(body, opts.entryState);
    } else if (opts.entryEvent) {
      const key = opts.entryEvent.toUpperCase();
      const body = eventBodies.get(key);
      if (!body) {
        console.error(`[CONVM] Event '${opts.entryEvent}' not found in this CON`);
        return emptyResult(1);
      }
      runSafe(body, key);
    } else if (opts.entryActor) {
      const body = actorBodies.get(opts.entryActor);
      if (!body) {
        console.error(`[CONVM] Actor picnum '${opts.entryActor}' not found in this CON`);
        return emptyResult(1);
      }
      // Fire EVENT_SPAWN before the actor body so per-actor custom properties
      // (_pCptr allocation) are initialised before the main loop reads them.
      const spawnBody = eventBodies.get('EVENT_SPAWN');
      if (spawnBody) runSafe(spawnBody, 'EVENT_SPAWN');
      runSafe(body, `actor_${opts.entryActor}`);
      // Optional two-pass GC: completes the deferred deletion cycle so the
      // memory report shows truly freed pages rather than "marked to free".
      // Enable with --2-pass-gc / opts.twoPassGC.
      if (opts.twoPassGC) {
        const gcBody = stateMap.get('_GC');
        if (gcBody) { runSafe(gcBody, '_GC'); runSafe(gcBody, '_GC'); }
      }
    }
  } else {
    // Phase 2: default event sequence
    resetPhasePeaks(state);
    for (const ev of DEFAULT_EVENTS) {
      const body = eventBodies.get(ev);
      if (body) { runSafe(body, ev); }
    }
    // Snapshot 2: after all events
    state.snapAfterEvents = takeSnapshot(state);
  }

  if (opts.showMemory) {
    printMemoryReport(state);
  }

  if (opts.testMode) {
    // Run any test-marked event bodies or defstates that weren't in the default event sequence
    const defaultEventsSet = new Set(DEFAULT_EVENTS);
    for (const [evName, body] of eventBodies) {
      if (!defaultEventsSet.has(evName) && body.length > 0
          && body[0].op === 'marker' && (body[0] as any).name === 'DEBUG-TEST') {
        runSafe(body, evName);
      }
    }
    for (const [stateName, body] of stateMap) {
      if (!stateName.startsWith('__') && body.length > 0
          && body[0].op === 'marker' && (body[0] as any).name === 'DEBUG-TEST') {
        runSafe(body, stateName);
      }
    }
    // Run test-marked actor bodies that haven't been executed yet as the entry point.
    // If entryActor is set the actor already ran in Phase 3 — skip it to avoid double execution.
    for (const [picnum, body] of actorBodies) {
      if (opts.entryActor === picnum) continue; // already ran
      if (body.length > 0 && body[0].op === 'marker' && (body[0] as any).name === 'DEBUG-TEST') {
        // Run EVENT_SPAWN first so _pCptr and custom props are initialised
        const spawnBody = eventBodies.get('EVENT_SPAWN');
        if (spawnBody) runSafe(spawnBody, 'EVENT_SPAWN');
        runSafe(body, `actor_${picnum}`);
      }
    }
    const result = printTestReport(state);
    result.report = buildSimReport(opts, opts.sourceFile ?? '', result.exitCode, state);
    return result;
  }

  const result = stateResult(0, state);
  result.report = buildSimReport(opts, opts.sourceFile ?? '', 0, state);
  return result;
}

function mergeStructFields(
  dst: Map<number, Map<string, number>>,
  src: Map<number, Map<string, number>>
): void {
  for (const [idx, fields] of src) {
    if (!dst.has(idx)) dst.set(idx, new Map());
    for (const [f, v] of fields) dst.get(idx)!.set(f, v);
  }
}

function computeHeapStats(state: VMState): SimReport['memory'] {
  const rds        = state.vars.get('rds') ?? 0;
  const allocTable = state.arrays.get('allocTable') ?? [];
  const blockPages = state.arrays.get('blockPages')  ?? [];
  const PAGE_SIZE  = 4; // words per physical page
  const heaptables = state.vars.get('heaptables')   ?? allocTable.length;
  const MARK_BIT   = 1024;

  let liveCount = 0, liveWords = 0;
  let markCount = 0, markWords = 0;
  const freeCount = 0, freeWords = 0;
  for (let i = 0; i < heaptables; i++) {
    const type  = allocTable[i] ?? 0;
    if (type === 0) continue; // free or continuation page
    const pages = blockPages[i] ?? 0;
    const size  = pages * PAGE_SIZE;
    if (type & MARK_BIT) { markCount++; markWords += size; }
    else                 { liveCount++; liveWords += size; }
  }
  return {
    stackBase: rds,
    stack: {
      afterInit:   state.snapAfterInit?.phaseRspHWM   ?? -1,
      afterEvents: state.snapAfterEvents?.phaseRspHWM ?? -1,
      peak:        state.peakRsp,
    },
    heap: {
      totalSlots:   heaptables,
      live:         { pages: liveCount, words: liveWords, bytes: liveWords * 4 },
      markedToFree: { pages: markCount, words: markWords, bytes: markWords * 4 },
      reclaimed:    { pages: freeCount, words: freeWords, bytes: freeWords * 4 },
    },
  };
}

function buildSimReport(
  opts:       VMRunOptions,
  sourceFile: string,
  exitCode:   number,
  state:      VMState,
): SimReport {
  const entryType = opts.entryActor ? 'actor'
                  : opts.entryEvent ? 'event'
                  : opts.entryState ? 'state'
                  : 'default';
  const entryId   = opts.entryActor ?? opts.entryEvent ?? opts.entryState;

  const vars: Record<string, number> = {};
  for (const [k, v] of state.vars) vars[k] = v;

  const actorFields: Record<number, Record<string, number>> = {};
  for (const [idx, fields] of state.actorFields) {
    actorFields[idx] = {};
    for (const [f, v] of fields) actorFields[idx][f] = v;
  }

  const testTotal  = state.testResults.reduce((s, r) => s + r.total,  0);
  const testPassed = state.testResults.reduce((s, r) => s + r.passed, 0);

  // ── Flat memory snapshot ──────────────────────────────────────────────────
  const flat       = state.arrays.get('flat') ?? [];
  const peakRsp    = state.peakRsp;
  const stackData  = Array.from(flat.slice(0, Math.max(0, peakRsp + 1))).map(v => v ?? 0);

  const allocTable = state.arrays.get('allocTable') ?? [];
  const blockPages = state.arrays.get('blockPages')  ?? [];
  const heaptables = state.vars.get('heaptables')   ?? allocTable.length;
  const stackBase  = state.vars.get('rds') ?? 0;
  const PAGE_SIZE  = 4; // words per physical page
  const MARK_BIT   = 1024;
  const TYPE_LABELS: Record<number, string> = { 1: 'array', 2: 'string', 4: 'object', 8: 'string_array', 16: 'peractor' };

  const heapPages: SimReport['flatMemory']['heapPages'] = [];
  for (let i = 0; i < heaptables; i++) {
    const rawType = allocTable[i] ?? 0;
    if (rawType === 0) continue; // free or continuation page
    const numPages  = blockPages[i] ?? 0;
    const sizeWords = numPages * PAGE_SIZE;
    const address   = stackBase + i * PAGE_SIZE; // physical-page address
    const baseType  = rawType & ~MARK_BIT;
    const marked    = (rawType & MARK_BIT) !== 0;
    const typeLabel = (marked ? 'marked:' : '') + (TYPE_LABELS[baseType] ?? `type${baseType}`);
    const data      = Array.from(flat.slice(address, address + sizeWords)).map(v => v ?? 0);
    heapPages.push({ address, type: rawType, typeLabel, sizeWords, data });
  }

  return {
    timestamp:  new Date().toISOString(),
    source:     sourceFile,
    entryPoint: { type: entryType, ...(entryId ? { id: entryId } : {}) },
    exitCode,
    memory:     computeHeapStats(state),
    tests: {
      ran:     state.testResults.length > 0,
      total:   testTotal,
      passed:  testPassed,
      failed:  testTotal - testPassed,
      results: state.testResults.map(r => ({ name: r.stateName, total: r.total, passed: r.passed })),
    },
    variables:   vars,
    actorFields,
    flatMemory: {
      stackBase:        state.vars.get('rds') ?? 0,
      peakStackPointer: peakRsp,
      stack:            stackData,
      heapPages,
    },
  };
}

function printMemoryReport(state: VMState): void {
  const m   = computeHeapStats(state);
  const rds = m.stackBase;
  const W   = 12;
  const W2  = 8;
  const pad  = (n: number | string) => String(n).padStart(W);
  const pad2 = (n: number | string) => String(n).padStart(W2);
  const hr = '─'.repeat(70);

  console.log(`\n${hr}`);
  console.log(` Memory report  (stack base rds = ${rds} words = ${rds * 4} bytes)`);
  console.log(`${hr}`);
  console.log(`  ${''.padEnd(16)}${'stack end'.padStart(W)}${'stack HWM'.padStart(W)}`);
  if (state.snapAfterInit)
    console.log(`  ${'After init:'.padEnd(16)}${pad(state.snapAfterInit.rsp)}${pad(state.snapAfterInit.phaseRspHWM)}`);
  if (state.snapAfterEvents)
    console.log(`  ${'After events:'.padEnd(16)}${pad(state.snapAfterEvents.rsp)}${pad(state.snapAfterEvents.phaseRspHWM)}`);
  console.log(`  ${'Peak:'.padEnd(16)}${pad(m.stack.peak)}${pad(m.stack.peak)}`);

  const { live: l, markedToFree: mk, reclaimed: rc } = m.heap;
  const totalCount = l.pages + mk.pages + rc.pages;
  const totalWords = l.words + mk.words + rc.words;

  console.log(`\n  Heap pages  (${m.heap.totalSlots} slots total)`);
  console.log(`  ${''.padEnd(24)}${'pages'.padStart(W2)}${'words'.padStart(W2)}${'bytes'.padStart(W2)}`);
  console.log(`  ${'Allocated (live):'.padEnd(24)}${pad2(l.pages)}${pad2(l.words)}${pad2(l.bytes)}`);
  console.log(`  ${'Marked to be freed:'.padEnd(24)}${pad2(mk.pages)}${pad2(mk.words)}${pad2(mk.bytes)}`);
  console.log(`  ${'Free (reclaimed):'.padEnd(24)}${pad2(rc.pages)}${pad2(rc.words)}${pad2(rc.bytes)}`);
  console.log(`  ${'Total used:'.padEnd(24)}${pad2(totalCount)}${pad2(totalWords)}${pad2(totalWords * 4)}`);
  console.log(`${hr}\n`);
}

function printTestReport(state: VMState): VMRunResult {
  const results = state.testResults;
  if (results.length === 0) {
    console.log('\n[TEST] No @DebugTest functions were executed.');
    return stateResult(0, state);
  }

  const hr = '─'.repeat(60);
  console.log(`\n${hr}`);
  console.log(' Test Results');
  console.log(hr);

  let totalAll = 0;
  let passedAll = 0;

  for (const r of results) {
    const failed = r.total - r.passed;
    const label = failed === 0
      ? `\x1b[32m[PASS]\x1b[0m`
      : `\x1b[31m[FAIL]\x1b[0m`;
    const detail = failed === 0
      ? `${r.passed}/${r.total}`
      : `${r.passed}/${r.total} (${failed} failed)`;
    console.log(`  ${label} ${r.stateName}: ${detail}`);
    totalAll += r.total;
    passedAll += r.passed;
  }

  const failedAll = totalAll - passedAll;
  console.log(hr);
  if (failedAll === 0) {
    console.log(`\x1b[32m  All ${totalAll} test(s) passed.\x1b[0m`);
  } else {
    console.log(`\x1b[31m  ${passedAll}/${totalAll} passed — ${failedAll} FAILED.\x1b[0m`);
  }
  console.log(`${hr}\n`);

  return stateResult(failedAll === 0 ? 0 : 1, state);
}

// Re-export Statement for callers that need the type
import type { Statement } from './Types';
export type { Statement };
