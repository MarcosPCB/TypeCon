import * as fs   from 'fs';
import * as path from 'path';
import { TsToConCompiler } from '../compiler/Compiler';
import { Linker }          from '../linker/Linker';
import { CONInit }         from '../compiler/framework';
import { runVM, VMRunOptions } from '../con-vm/index';
import { validateCON } from '../con-validator/index';

// ── ANSI helpers (local copy; avoids importing from main.ts) ─────────────────
const C = {
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
};

// ── Assertion types ───────────────────────────────────────────────────────────

type AssertOp = { eq?: number; ne?: number; gt?: number; lt?: number; ge?: number; le?: number };
type AssertValue = number | AssertOp;

interface TestExpect {
  vars?:         Record<string, AssertValue>;
  actorFields?:  Record<string, Record<string, AssertValue>>;
  playerFields?: Record<string, Record<string, AssertValue>>;
  sectorFields?: Record<string, Record<string, AssertValue>>;
  wallFields?:   Record<string, Record<string, AssertValue>>;
}

function evalAssert(actual: number, expected: AssertValue): boolean {
  if (typeof expected === 'number') return actual === expected;
  if (expected.eq !== undefined) return actual === expected.eq;
  if (expected.ne !== undefined) return actual !== expected.ne;
  if (expected.gt !== undefined) return actual >  expected.gt;
  if (expected.lt !== undefined) return actual <  expected.lt;
  if (expected.ge !== undefined) return actual >= expected.ge;
  if (expected.le !== undefined) return actual <= expected.le;
  // Unknown operator — fail and warn so typos don't silently pass
  const unknownOp = Object.keys(expected)[0] ?? '?';
  console.warn(C.yellow(`  [ASSERT] Unknown operator "${unknownOp}" — valid ops: eq ne gt lt ge le`));
  return false;
}

function assertLabel(expected: AssertValue): string {
  if (typeof expected === 'number') return `== ${expected}`;
  const [op, v] = Object.entries(expected)[0] ?? ['?', '?'];
  const sym: Record<string, string> = { eq: '==', ne: '!=', gt: '>', lt: '<', ge: '>=', le: '<=' };
  return `${sym[op] ?? op} ${v}`;
}

function checkVarAsserts(
  spec: Record<string, AssertValue> | undefined,
  vars: Map<string, number>,
  out: string[]
): void {
  if (!spec) return;
  for (const [name, expected] of Object.entries(spec)) {
    const actual = vars.get(name) ?? 0;
    if (!evalAssert(actual, expected))
      out.push(`vars.${name}: expected ${assertLabel(expected)}, got ${actual}`);
  }
}

function checkStructAsserts(
  label: string,
  spec: Record<string, Record<string, AssertValue>> | undefined,
  map: Map<number, Map<string, number>>,
  out: string[]
): void {
  if (!spec) return;
  for (const [idxStr, fields] of Object.entries(spec)) {
    const idx = parseInt(idxStr, 10);
    for (const [field, expected] of Object.entries(fields)) {
      const actual = map.get(idx)?.get(field) ?? 0;
      if (!evalAssert(actual, expected))
        out.push(`${label}[${idx}].${field}: expected ${assertLabel(expected)}, got ${actual}`);
    }
  }
}

// ── JSON schema interfaces ────────────────────────────────────────────────────

interface TestScript {
  name?: string;
  source: string[];           // TS source files, relative to the JSON file
  defaultInclusion?: boolean; // prepend `include GAME.CON`; default true
  outputFolder?: string;      // where to write the .con;  default 'compiled'
  output?: string;            // output filename;           default <first source>.con
  linePrint?: boolean;        // emit original TS lines as comments (-dl); default false
  memTest?: boolean;          // print memory report after each test run (--mem); default false
  validate?: boolean;         // run validator before simulation; default true
  tests: TestCase[];
}

interface TestCase {
  name: string;
  runActor?: string;  // --actor PICNUM
  runEvent?: string;  // --event NAME
  runState?: string;  // --state NAME
  noInit?: boolean;
  setup?: {
    actorFields?:  Record<string, Record<string, number>>;
    playerFields?: Record<string, Record<string, number>>;
    sectorFields?: Record<string, Record<string, number>>;
    wallFields?:   Record<string, Record<string, number>>;
  };
  expect?: TestExpect;  // post-simulation assertions on VM state
}

// ── Field-override helper ─────────────────────────────────────────────────────

function parseSetup(
  rec?: Record<string, Record<string, number>>
): Map<number, Map<string, number>> | undefined {
  if (!rec) return undefined;
  const out = new Map<number, Map<string, number>>();
  for (const [idxStr, fields] of Object.entries(rec)) {
    const idx = parseInt(idxStr, 10);
    if (isNaN(idx)) continue;
    out.set(idx, new Map(Object.entries(fields) as [string, number][]));
  }
  return out.size > 0 ? out : undefined;
}

// ── Suite summary printer ─────────────────────────────────────────────────────

function printSuiteSummary(
  suiteName: string,
  results: { name: string; passed: boolean; failures: string[] }[]
): void {
  const hr = '─'.repeat(50);
  console.log(`\n${hr}`);
  console.log(` ${C.cyan(suiteName)}`);
  console.log(hr);
  for (const r of results) {
    const tag = r.passed ? C.green('[PASS]') : C.red('[FAIL]');
    console.log(`  ${tag} ${r.name}`);
    for (const f of r.failures) {
      console.log(`         ${C.red(f)}`);
    }
  }
  console.log(hr);
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  if (failed === 0) {
    console.log(C.green(`  All ${results.length} test case(s) passed.`));
  } else {
    console.log(C.red(`  ${passed}/${results.length} passed — ${failed} FAILED.`));
  }
  console.log(`${hr}\n`);
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runTestScript(jsonPath: string, pkgDir: string): Promise<void> {
  // ── Load JSON ───────────────────────────────────────────────────────────
  let script: TestScript;
  try {
    script = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as TestScript;
  } catch (e) {
    console.error(C.red(`Error: Failed to read test script: ${e}`));
    process.exitCode = 1; return;
  }

  if (!script.source || script.source.length === 0) {
    console.error(C.red('Error: test script must have at least one entry in "source"'));
    process.exitCode = 1; return;
  }
  if (!script.tests || script.tests.length === 0) {
    console.error(C.red('Error: test script must have at least one entry in "tests"'));
    process.exitCode = 1; return;
  }

  const scriptDir  = path.dirname(path.resolve(jsonPath));
  const cwd        = process.cwd();
  const sources    = script.source.map(s => path.resolve(scriptDir, s));
  const outFolder  = path.resolve(cwd, script.outputFolder ?? 'compiled');
  const outFile    = script.output ?? (path.basename(sources[0], '.ts') + '.con');
  const conPath    = path.join(outFolder, outFile);

  // ── Compile ─────────────────────────────────────────────────────────────
  const objDir = path.join(cwd, 'obj');
  if (!fs.existsSync(objDir)) fs.mkdirSync(objDir, { recursive: true });
  if (!fs.existsSync(outFolder)) fs.mkdirSync(outFolder, { recursive: true });

  console.log(C.cyan(`\nCompiling ${sources.length} source file(s)...`));
  const compiler = new TsToConCompiler({ lineDetail: script.linePrint ?? false, mode: 'module', stackSize: 8192, heapNumPages: 14336 });
  let sharedContext: any;
  const tcoFiles: string[] = [];

  for (const src of sources) {
    if (!fs.existsSync(src)) {
      console.error(C.red(`Error: Source file not found: ${src}`));
      process.exitCode = 1; return;
    }
    const result = compiler.compileModule(fs.readFileSync(src, 'utf-8'), src, sharedContext);
    if (!result?.module) {
      console.error(C.red(`Error: Compilation failed for ${src}`));
      process.exitCode = 1; return;
    }
    sharedContext = result.context;
    const tcoPath = path.join(objDir, path.basename(src, '.ts') + '.tco');
    fs.writeFileSync(tcoPath, JSON.stringify(result.module, (k, v) => k === 'parent' ? undefined : v, 2));
    tcoFiles.push(tcoPath);
    console.log(`  ${C.green('OK')} ${path.relative(cwd, src)}`);
  }

  // ── Link ────────────────────────────────────────────────────────────────
  console.log(C.cyan(`\nLinking → ${path.relative(cwd, conPath)}`));
  const initSys = new CONInit(8192, 4, 14336, true, 4 * 14336, 0, false);
  const linker  = new Linker(outFolder, initSys, false, false, false);
  for (const tco of tcoFiles) linker.loadModule(tco);

  const { code: linkedCode } = linker.link();
  let finalCode = linkedCode;
  if (script.defaultInclusion !== false) {
    finalCode = `include GAME.CON\n\n` + finalCode;
  }
  fs.writeFileSync(conPath, finalCode);

  const conSource = fs.readFileSync(conPath, 'utf-8');

  // ── Build search dirs (needed for both validate and simulate) ─────────────
  const baseCONDir  = path.join(cwd, 'baseCON');
  const pkgBaseCON  = path.join(pkgDir, '..', 'baseCON');
  const baseCONDirs = [baseCONDir, pkgBaseCON].filter(
    (d, i, arr) => fs.existsSync(d) && arr.indexOf(d) === i
  );
  const searchDirs = [...baseCONDirs, path.dirname(conPath)];

  // ── Validate (skipped when validate: false) ───────────────────────────────
  if (script.validate !== false) {
    console.log(C.cyan(`\nValidating...`));
    const valResult = validateCON(conSource, { baseDirs: [path.dirname(conPath), ...baseCONDirs] });
    let hasErrors = false;
    for (const d of valResult.diagnostics) {
      const tag = d.severity === 'error' ? C.red('[ERROR]') : C.yellow('[WARN] ');
      console.log(`  ${tag} ${d.file ?? conPath}:${d.line}  ${d.code} — ${d.message}`);
      if (d.severity === 'error') hasErrors = true;
    }
    if (hasErrors) {
      console.error(C.red(`Validation failed — aborting simulation.`));
      process.exitCode = 1; return;
    }
    console.log(`  ${C.green('OK')}  ${path.relative(cwd, conPath)}  (${valResult.symbolTable.usageSummary()})`);
  }

  // ── Run each test case ──────────────────────────────────────────────────
  console.log(C.cyan(`\nRunning ${script.tests.length} test case(s)...\n`));

  const results: { name: string; passed: boolean; failures: string[] }[] = [];

  for (const tc of script.tests) {
    if (!tc.runActor && !tc.runEvent && !tc.runState) {
      console.warn(C.yellow(`  [SKIP] "${tc.name}" — no runActor/runEvent/runState specified`));
      results.push({ name: tc.name, passed: false, failures: ['no entry point specified'] });
      continue;
    }

    // actor takes priority if multiple are set
    const entry = tc.runActor
      ? { entryActor: tc.runActor }
      : tc.runEvent
        ? { entryEvent: tc.runEvent }
        : { entryState: tc.runState };

    const opts: VMRunOptions = {
      ...entry,
      noInit:      tc.noInit ?? false,
      testMode:    true,
      showMemory:  script.memTest ?? false,
      searchDirs,
      actorFieldOverrides:  parseSetup(tc.setup?.actorFields),
      playerFieldOverrides: parseSetup(tc.setup?.playerFields),
      sectorFieldOverrides: parseSetup(tc.setup?.sectorFields),
      wallFieldOverrides:   parseSetup(tc.setup?.wallFields),
    };

    console.log(`${C.cyan('▶')} ${tc.name}`);
    const failures: string[] = [];
    let passed = false;
    try {
      const r = runVM(conSource, opts);
      // Check @DebugTest assertion result
      if (r.exitCode !== 0) failures.push('in-source @DebugTest assertions failed');
      // Check post-simulation expect assertions
      if (tc.expect) {
        checkVarAsserts(tc.expect.vars, r.vars, failures);
        checkStructAsserts('actorFields',  tc.expect.actorFields,  r.actorFields,  failures);
        checkStructAsserts('playerFields', tc.expect.playerFields, r.playerFields, failures);
        checkStructAsserts('sectorFields', tc.expect.sectorFields, r.sectorFields, failures);
        checkStructAsserts('wallFields',   tc.expect.wallFields,   r.wallFields,   failures);
      }
      passed = failures.length === 0;
    } catch (e) {
      failures.push(`crashed: ${e}`);
      console.error(C.red(`  Crashed: ${e}`));
    }
    if (failures.length > 0) {
      for (const f of failures) console.log(C.red(`  [ASSERT] ${f}`));
    }
    results.push({ name: tc.name, passed, failures });
  }

  // ── Print suite summary ─────────────────────────────────────────────────
  printSuiteSummary(script.name ?? path.basename(jsonPath), results);
  process.exitCode = results.some(r => !r.passed) ? 1 : 0;
}

// ── Single-file TypeScript test runner ───────────────────────────────────────

export async function runTestTs(tsPath: string, pkgDir: string): Promise<void> {
  const cwd     = process.cwd();
  const src     = path.resolve(tsPath);
  const name    = path.basename(src, '.ts');
  const objDir  = path.join(cwd, 'obj');
  const outDir  = path.join(cwd, 'compiled');
  const conPath = path.join(outDir, name + '.con');

  // ── Clean ────────────────────────────────────────────────────────────────
  console.log(C.cyan(`\nCleaning build folders...`));
  for (const [d, ext] of [[objDir, '.tco'], [outDir, '.con']] as [string, string][]) {
    if (!fs.existsSync(d)) { fs.mkdirSync(d, { recursive: true }); continue; }
    fs.readdirSync(d).filter(f => f.endsWith(ext)).forEach(f => fs.unlinkSync(path.join(d, f)));
  }

  // ── Compile ──────────────────────────────────────────────────────────────
  console.log(C.cyan(`Compiling ${path.relative(cwd, src)}...`));
  const compiler = new TsToConCompiler({ lineDetail: false, mode: 'module', stackSize: 8192, heapNumPages: 14336 });
  let sharedContext: any;
  const tcoFiles: string[] = [];

  const result = compiler.compileModule(fs.readFileSync(src, 'utf-8'), src, sharedContext);
  if (!result?.module) {
    console.error(C.red(`Error: Compilation failed for ${path.relative(cwd, src)}`));
    process.exitCode = 1; return;
  }
  sharedContext = result.context;
  const tcoPath = path.join(objDir, name + '.tco');
  fs.writeFileSync(tcoPath, JSON.stringify(result.module, (k, v) => k === 'parent' ? undefined : v, 2));
  tcoFiles.push(tcoPath);
  console.log(`  ${C.green('OK')} ${path.relative(cwd, src)}`);

  // ── Link ─────────────────────────────────────────────────────────────────
  console.log(C.cyan(`\nLinking → compiled/${name}.con`));
  const initSys  = new CONInit(8192, 4, 14336, true, 4 * 14336, 0, false);
  const linker   = new Linker(outDir, initSys, false, false, false);
  for (const tco of tcoFiles) linker.loadModule(tco);
  const { code: linkedCode } = linker.link();
  const finalCode = `include GAME.CON\n\n` + linkedCode;
  fs.writeFileSync(conPath, finalCode);

  const conSource = fs.readFileSync(conPath, 'utf-8');

  // ── Validate ─────────────────────────────────────────────────────────────
  console.log(C.cyan(`\nValidating...`));
  const baseCONDir  = path.join(cwd, 'baseCON');
  const pkgBaseCON  = path.join(pkgDir, '..', 'baseCON');
  const baseCONDirs = [baseCONDir, pkgBaseCON].filter(
    (d, i, arr) => fs.existsSync(d) && arr.indexOf(d) === i
  );
  const valResult = validateCON(conSource, { baseDirs: [path.dirname(conPath), ...baseCONDirs] });
  let hasErrors = false;
  for (const d of valResult.diagnostics) {
    const tag = d.severity === 'error' ? C.red('[ERROR]') : C.yellow('[WARN] ');
    console.log(`  ${tag} ${d.file ?? conPath}:${d.line}  ${d.code} — ${d.message}`);
    if (d.severity === 'error') hasErrors = true;
  }
  if (hasErrors) {
    console.error(C.red(`Validation failed — aborting simulation.`));
    process.exitCode = 1; return;
  }
  console.log(`  ${C.green('OK')}  ${path.relative(cwd, conPath)}  (${valResult.symbolTable.usageSummary()})`);

  // ── Simulate with --test and --mem ────────────────────────────────────────
  console.log(C.cyan(`\nSimulating with --test --mem...\n`));
  const searchDirs = [...baseCONDirs, path.dirname(conPath)];
  const vmResult = runVM(conSource, { testMode: true, showMemory: true, searchDirs });
  process.exitCode = vmResult.exitCode;
}
