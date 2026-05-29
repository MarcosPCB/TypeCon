import * as fs   from 'fs';
import * as path from 'path';
import fsExtra   = require('fs-extra');
import { MakeConfig, MakeModuleEntry } from './types';
import { TsToConCompiler } from '../compiler/Compiler';
import { Linker }          from '../linker/Linker';
import { CONInit }         from '../compiler/framework';
import { validateCON }     from '../con-validator/index';

const C = {
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
};

export type MakeStep = 'clean' | 'compile' | 'link' | 'validate' | 'all';

export function loadConfig(configPath: string): MakeConfig {
  if (!fs.existsSync(configPath)) {
    console.error(`${C.red('Error:')} typecon.json not found at ${configPath}`);
    console.error(`Run ${C.cyan('tcc make create')} to generate one.`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as MakeConfig;
  } catch (e) {
    console.error(`${C.red('Error:')} Failed to parse typecon.json: ${e}`);
    process.exit(1);
  }
}

// ── Simple glob expander (handles * and **) ──────────────────────────────────

function matchGlob(filePath: string, pattern: string): boolean {
  const p = pattern.replace(/\\/g, '/');
  const f = filePath.replace(/\\/g, '/');
  const regexStr = p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')   // escape regex special chars
    .replace(/\*\*\//g, '\x00')              // **/ → optional segment group
    .replace(/\*\*/g, '\x01')               // ** alone → any chars
    .replace(/\*/g, '[^/]+')                // * → no slash allowed
    .replace(/\x00/g, '(.+/)?')            // **/ → zero or more path segments
    .replace(/\x01/g, '.+');               // ** → anything
  return new RegExp(`^${regexStr}$`).test(f);
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else results.push(full);
  }
  return results;
}

function expandGlob(pattern: string, cwd: string): string[] {
  // No wildcards — treat as a direct file path
  if (!pattern.includes('*')) {
    const full = path.join(cwd, pattern);
    return fs.existsSync(full) ? [pattern] : [];
  }

  const parts = pattern.split('/');
  const staticParts: string[] = [];
  for (const part of parts) {
    if (part.includes('*')) break;
    staticParts.push(part);
  }
  const baseDir = staticParts.length > 0 ? path.join(cwd, ...staticParts) : cwd;
  return walkDir(baseDir)
    .map(f => path.relative(cwd, f).replace(/\\/g, '/'))
    .filter(f => matchGlob(f, pattern));
}

export function expandSourceGlobs(cfg: MakeConfig, cwd: string): string[] {
  const patterns = cfg.sources ?? ['src/**/*.ts'];
  const allFiles = new Set<string>();
  for (const pattern of patterns)
    for (const f of expandGlob(pattern, cwd)) allFiles.add(f);
  return [...allFiles];
}

export function resolveSourceFiles(cfg: MakeConfig, cwd: string): string[] {
  const patterns = cfg.sources ?? ['src/**/*.ts'];
  const allFiles = new Set<string>();
  for (const pattern of patterns)
    for (const f of expandGlob(pattern, cwd)) allFiles.add(f);

  const overrides = new Map<string, MakeModuleEntry>();
  for (const m of cfg.modules ?? [])
    overrides.set(m.path.replace(/\\/g, '/'), m);

  return [...allFiles].filter(f => {
    const entry = overrides.get(f);
    return entry ? entry.enabled : true;
  });
}

// ── Pipeline orchestrator ────────────────────────────────────────────────────

export async function runMake(step: MakeStep, cfg: MakeConfig): Promise<void> {
  const cwd            = process.cwd();
  const objDir         = cfg.objDir         ?? 'obj';
  const outputDir      = cfg.outputDir      ?? 'compiled';
  const output         = cfg.output         ?? 'GAME.CON';
  const stackSize      = cfg.stackSize      ?? 1024;
  const heapPageSize   = cfg.heapPageSize   ?? 4;
  const heapPageNumber = cfg.heapPageNumber ?? 128;
  const doAll          = step === 'all';

  // ── CLEAN (only when explicitly requested — not part of the full pipeline) ─
  if (step === 'clean') {
    console.log(C.yellow('Clearing build folders...'));
    for (const folder of [objDir, 'asm', outputDir]) {
      const full = path.join(cwd, folder);
      if (fs.existsSync(full)) {
        console.log(`  Clearing ${folder}/`);
        fsExtra.emptyDirSync(full);
      }
    }
    return;
  }

  // ── COMPILE ──────────────────────────────────────────────────────────────
  if (step === 'compile' || doAll) {
    const srcFiles = resolveSourceFiles(cfg, cwd);
    if (srcFiles.length === 0) {
      console.error(C.red('Error: No source files matched. Check `sources` in typecon.json.'));
      process.exit(1);
    }

    const fullObjDir = path.join(cwd, objDir);
    if (!fs.existsSync(fullObjDir)) fs.mkdirSync(fullObjDir, { recursive: true });

    console.log(C.cyan(`Compiling ${srcFiles.length} file(s) → ${objDir}/`));
    const compiler = new TsToConCompiler({ lineDetail: false, mode: 'module' });
    let sharedContext: any;
    for (const relPath of srcFiles) {
      const fullPath = path.join(cwd, relPath);
      const result = compiler.compileModule(fs.readFileSync(fullPath, 'utf-8'), fullPath, sharedContext);
      if (result?.module) {
        sharedContext = result.context;
        const outPath = path.join(fullObjDir, path.basename(relPath, '.ts') + '.tco');
        fs.writeFileSync(outPath, JSON.stringify(result.module, (k, v) => k === 'parent' ? undefined : v, 2));
        console.log(`  ${C.green('OK')} ${relPath}`);
      } else {
        console.error(`  ${C.red('FAIL')} ${relPath}`);
        process.exit(1);
      }
    }
    if (step === 'compile') return;
  }

  // ── LINK ─────────────────────────────────────────────────────────────────
  if (step === 'link' || doAll) {
    const fullObjDir    = path.join(cwd, objDir);
    const fullOutputDir = path.join(cwd, outputDir);
    if (!fs.existsSync(fullOutputDir)) fs.mkdirSync(fullOutputDir, { recursive: true });

    const tcoFiles = fs.existsSync(fullObjDir)
      ? fs.readdirSync(fullObjDir).filter(f => f.endsWith('.tco')).map(f => path.join(fullObjDir, f))
      : [];

    if (tcoFiles.length === 0) {
      console.error(C.red(`Error: No .tco files in ${objDir}/. Run compile first.`));
      process.exit(1);
    }

    const initSys = new CONInit(stackSize, heapPageSize, heapPageNumber, cfg.precompiledModules ?? true, heapPageSize * heapPageNumber, 0, false);
    const linker  = new Linker(fullOutputDir, initSys, false, false, false);
    for (const tco of tcoFiles) linker.loadModule(tco);

    const { code: linkedCode } = linker.link();
    let finalCode = linkedCode;
    if (cfg.defaultInclusion) finalCode = `include GAME.CON\n\n` + finalCode;

    const outPath = path.join(fullOutputDir, output);
    fs.writeFileSync(outPath, finalCode);
    console.log(`${C.cyan('Linked →')} ${outputDir}/${output}`);
    if (step === 'link') return;
  }

  // ── VALIDATE ─────────────────────────────────────────────────────────────
  const runValidate = step === 'validate' || (doAll && cfg.validate?.enabled !== false);
  if (runValidate) {
    const validateCfg = cfg.validate ?? {};
    const outPath = path.join(cwd, outputDir, output);
    if (!fs.existsSync(outPath)) {
      console.error(C.red(`Error: ${outputDir}/${output} not found. Run link first.`));
      process.exit(1);
    }

    const text     = fs.readFileSync(outPath, 'utf-8');
    const baseDirs = [...(validateCfg.baseDirs ?? []).map(d => path.join(cwd, d)), path.join(cwd, outputDir)];
    const result   = validateCON(text, { warnNearLimits: validateCfg.warnNearLimits ?? true, baseDirs });

    for (const inc of result.includedFiles) {
      if (!inc.diagnostics.some(d => d.severity === 'error'))
        console.log(`${C.green('OK')}  ${inc.filePath}`);
    }

    if (result.diagnostics.length === 0) {
      console.log(`${C.green('OK')}  ${outputDir}/${output}  (${result.symbolTable.usageSummary()})`);
    } else {
      for (const d of result.diagnostics) {
        const tag = d.severity === 'error' ? C.red('[ERROR]') : `\x1b[33m[WARN] \x1b[0m`;
        console.log(`${tag} ${d.file ?? outPath}:${d.line}  ${d.code} — ${d.message}`);
      }
      if (!result.ok) process.exit(1);
    }
  }
}
