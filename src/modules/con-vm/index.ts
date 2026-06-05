import { CONParser } from './Parser';
import { createVMState, resetPhasePeaks, takeSnapshot, VMState, TestResult } from './Memory';
import { executeStatements, TerminateSignal, ExitStateSignal, BreakSignal } from './Interpreter';

export interface VMRunOptions {
  entryState?: string;  // explicit defstate to run (--state NAME)
  noInit?: boolean;     // skip EVENT_INIT → EVENT_INITCOMPLETE → EVENT_SETDEFAULTS → EVENT_NEWGAME preamble
  showMemory?: boolean; // print memory usage report after simulation
  testMode?: boolean;   // print structured pass/fail summary and return exit code
}

export interface VMRunResult {
  exitCode: number; // 0 = all tests passed (or no tests), 1 = failures
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
  const parser = new CONParser(source);
  const { stateMap, defines, initStatements, eventBodies } = parser.parse();

  const state = createVMState();
  state.defines = defines;

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

  if (opts.entryState) {
    // Phase 2: game-lifecycle events
    resetPhasePeaks(state);
    if (!opts.noInit) {
      for (const ev of DEFAULT_EVENTS) {
        const body = eventBodies.get(ev);
        if (body) { runSafe(body, ev); }
      }
    }
    // Snapshot 2: after init events, before entry state
    state.snapAfterEvents = takeSnapshot(state);

    // Phase 3: entry state
    resetPhasePeaks(state);
    const body = stateMap.get(opts.entryState);
    if (!body) {
      console.error(`[CONVM] State '${opts.entryState}' not found`);
      return { exitCode: 1 };
    }
    runSafe(body, opts.entryState);
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

  return { exitCode: 0 };
}

function printMemoryReport(state: VMState): void {
  const rds = state.vars.get('rds') ?? 0;
  const snap1 = state.snapAfterInit;
  const snap2 = state.snapAfterEvents;

  function heapOf(flatIdx: number) { return flatIdx >= rds ? flatIdx - rds + 1 : 0; }

  const W = 11;
  const pad = (n: number) => String(n).padStart(W);
  const hr = '─'.repeat(68);

  console.log(`\n${hr}`);
  console.log(` Memory report  (stack base rds = ${rds} words = ${rds * 4} bytes)`);
  console.log(`${hr}`);
  console.log(`  ${''.padEnd(16)}${'stack end'.padStart(W)}${'stack HWM'.padStart(W)}${'heap end'.padStart(W)}${'heap HWM'.padStart(W)}`);

  if (snap1) {
    const stackEnd = snap1.rsp;
    const stackHWM = snap1.phaseRspHWM;
    const heapEnd  = heapOf(snap1.flatLen - 1);
    const heapHWM  = heapOf(snap1.phaseFlatHWM);
    console.log(`  ${'After init:'.padEnd(16)}${pad(stackEnd)}${pad(stackHWM)}${pad(heapEnd)}${pad(heapHWM)}`);
  }
  if (snap2) {
    const stackEnd = snap2.rsp;
    const stackHWM = snap2.phaseRspHWM;
    const heapEnd  = heapOf(snap2.flatLen - 1);
    const heapHWM  = heapOf(snap2.phaseFlatHWM);
    console.log(`  ${'After events:'.padEnd(16)}${pad(stackEnd)}${pad(stackHWM)}${pad(heapEnd)}${pad(heapHWM)}`);
  }
  // Peak row uses all-time maximums
  const peakFlatLen = state.arrays.get('flat')?.length ?? 0;
  console.log(`  ${'Peak:'.padEnd(16)}${pad(state.peakRsp)}${pad(state.peakRsp)}${pad(heapOf(peakFlatLen - 1))}${pad(heapOf(state.peakFlatIdx))}`);
  console.log(`${hr}\n`);
}

function printTestReport(state: VMState): VMRunResult {
  const results = state.testResults;
  if (results.length === 0) {
    console.log('\n[TEST] No @DebugTest functions were executed.');
    return { exitCode: 0 };
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

  return { exitCode: failedAll === 0 ? 0 : 1 };
}

// Re-export Statement for callers that need the type
import type { Statement } from './Types';
export type { Statement };
