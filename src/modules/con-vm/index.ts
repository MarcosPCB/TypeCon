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
  searchDirs?: string[]; // directories to search for include files (CON dir, baseCON, …)
  // Pre-seed game structure fields before simulation (index → field → value)
  actorFieldOverrides?:  Map<number, Map<string, number>>;
  playerFieldOverrides?: Map<number, Map<string, number>>;
  sectorFieldOverrides?: Map<number, Map<string, number>>;
  wallFieldOverrides?:   Map<number, Map<string, number>>;
}

export interface VMRunResult {
  exitCode: number; // 0 = all tests passed (or no tests), 1 = failures
  // Final VM state — exposed for post-simulation assertions in tcc test
  vars:         Map<string, number>;
  actorFields:  Map<number, Map<string, number>>;
  playerFields: Map<number, Map<string, number>>;
  sectorFields: Map<number, Map<string, number>>;
  wallFields:   Map<number, Map<string, number>>;
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
      runSafe(body, `actor_${opts.entryActor}`);
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
    return printTestReport(state);
  }

  return stateResult(0, state);
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

function printMemoryReport(state: VMState): void {
  const rds        = state.vars.get('rds') ?? 0;
  const snap1      = state.snapAfterInit;
  const snap2      = state.snapAfterEvents;
  const allocTable = state.arrays.get('allocTable') ?? [];
  const pageSizes  = state.arrays.get('pageSizes')  ?? [];
  const heaptables = state.vars.get('heaptables')   ?? allocTable.length;

  const W  = 12;
  const W2 = 8;
  const pad  = (n: number | string) => String(n).padStart(W);
  const pad2 = (n: number | string) => String(n).padStart(W2);
  const hr = '─'.repeat(70);

  // ── Stack table ───────────────────────────────────────────────────────────
  console.log(`\n${hr}`);
  console.log(` Memory report  (stack base rds = ${rds} words = ${rds * 4} bytes)`);
  console.log(`${hr}`);
  console.log(`  ${''.padEnd(16)}${'stack end'.padStart(W)}${'stack HWM'.padStart(W)}`);

  if (snap1)
    console.log(`  ${'After init:'.padEnd(16)}${pad(snap1.rsp)}${pad(snap1.phaseRspHWM)}`);
  if (snap2)
    console.log(`  ${'After events:'.padEnd(16)}${pad(snap2.rsp)}${pad(snap2.phaseRspHWM)}`);
  console.log(`  ${'Peak:'.padEnd(16)}${pad(state.peakRsp)}${pad(state.peakRsp)}`);

  // ── Heap page table ───────────────────────────────────────────────────────
  // allocTable bit layout (from framework.ts):
  //   0          → free (never used or reclaimed)
  //   type > 0   → allocated (live)
  //   type|1024  → marked to be freed (GC first-pass candidate)
  const MARK_BIT = 1024;

  let liveCount = 0,   liveWords = 0;
  let markCount = 0,   markWords = 0;
  let freeCount = 0,   freeWords = 0;

  for (let i = 0; i < heaptables; i++) {
    const type = allocTable[i] ?? 0;
    const size = pageSizes[i]  ?? 0;
    if (type & MARK_BIT) {
      markCount++;
      markWords += size;
    } else if (type !== 0) {
      liveCount++;
      liveWords += size;
    } else if (size !== 0) {
      // allocTable[i]==0 AND pageSizes[i]!=0 → previously allocated, now reclaimed
      freeCount++;
      freeWords += size;
    }
  }

  const totalCount = liveCount + markCount + freeCount;
  const totalWords = liveWords + markWords + freeWords;

  console.log(`\n  Heap pages  (${heaptables} slots total)`);
  console.log(`  ${''.padEnd(24)}${'pages'.padStart(W2)}${'words'.padStart(W2)}${'bytes'.padStart(W2)}`);
  console.log(`  ${'Allocated (live):'.padEnd(24)}${pad2(liveCount)}${pad2(liveWords)}${pad2(liveWords * 4)}`);
  console.log(`  ${'Marked to be freed:'.padEnd(24)}${pad2(markCount)}${pad2(markWords)}${pad2(markWords * 4)}`);
  console.log(`  ${'Free (reclaimed):'.padEnd(24)}${pad2(freeCount)}${pad2(freeWords)}${pad2(freeWords * 4)}`);
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
