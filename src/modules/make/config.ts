import * as fs   from 'fs';
import * as path from 'path';
import inquirer  from 'inquirer';
import { MakeConfig, MakeModuleEntry } from './types';
import { loadConfig } from './index';

// ── Colour helpers ────────────────────────────────────────────────────────────
const C = {
  cyan:  (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow:(s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  dim:   (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold:  (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// ── Lockable field definitions ────────────────────────────────────────────────
const LOCKABLE_FIELDS = [
  { key: 'objDir',                  label: 'Object output directory' },
  { key: 'outputDir',               label: 'Compiled output directory' },
  { key: 'output',                  label: 'Output CON file name' },
  { key: 'stackSize',               label: 'Stack size' },
  { key: 'heapPageSize',            label: 'Heap page size' },
  { key: 'heapPageNumber',          label: 'Heap page count' },
  { key: 'defaultInclusion',        label: 'Include default GAME.CON' },
  { key: 'precompiledModules',      label: 'Pre-compiled system modules' },
  { key: 'validate.enabled',        label: 'Run validator after link' },
  { key: 'validate.warnNearLimits', label: 'Warn near resource limits' },
  { key: 'validate.baseDirs',       label: 'Validator base dirs' },
  { key: 'modules',                 label: 'Module required status (locks which modules are required)' },
  { key: 'locked',                  label: 'Lock management (prevents editing this list in tcc make config)' },
] as const;

type FieldKey = typeof LOCKABLE_FIELDS[number]['key'];

function currentValue(cur: MakeConfig, key: FieldKey): string {
  switch (key) {
    case 'objDir':                  return cur.objDir                  ?? 'obj';
    case 'outputDir':               return cur.outputDir               ?? 'compiled';
    case 'output':                  return cur.output                  ?? 'GAME.CON';
    case 'stackSize':               return String(cur.stackSize        ?? 1024);
    case 'heapPageSize':            return String(cur.heapPageSize     ?? 4);
    case 'heapPageNumber':          return String(cur.heapPageNumber   ?? 128);
    case 'defaultInclusion':        return String(cur.defaultInclusion ?? false);
    case 'precompiledModules':      return String(cur.precompiledModules ?? true);
    case 'validate.enabled':        return String(cur.validate?.enabled        ?? true);
    case 'validate.warnNearLimits': return String(cur.validate?.warnNearLimits ?? true);
    case 'validate.baseDirs':       return (cur.validate?.baseDirs ?? []).join(', ') || 'baseCON';
    case 'modules':
    case 'locked':                  return '';
  }
}

// ── Glob helpers ──────────────────────────────────────────────────────────────

function matchGlob(filePath: string, pattern: string): boolean {
  const p = pattern.replace(/\\/g, '/');
  const f = filePath.replace(/\\/g, '/');
  const regexStr = p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\x00')
    .replace(/\*\*/g, '\x01')
    .replace(/\*/g, '[^/]+')
    .replace(/\x00/g, '(.+/)?')
    .replace(/\x01/g, '.+');
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
  if (!pattern.includes('*')) {
    const full = path.join(cwd, pattern);
    return fs.existsSync(full) ? [pattern] : [];
  }
  const parts       = pattern.split('/');
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

// Returns all files for the module UI: glob results PLUS any path already in modules[].
function getModuleChoiceFiles(cfg: MakeConfig, cwd: string): string[] {
  const patterns = cfg.sources ?? ['src/**/*.ts'];
  const found = new Set<string>();
  for (const pattern of patterns)
    for (const f of expandGlob(pattern, cwd)) found.add(normalise(f));
  for (const m of cfg.modules ?? []) found.add(normalise(m.path));
  return sortByFolder([...found]);
}

// ── Module UI helpers ─────────────────────────────────────────────────────────

type Choice = { name: string; value: string; checked: boolean; disabled?: string | boolean };

function buildFolderChoices(
  files: string[],
  isChecked:  (f: string) => boolean,
  isDisabled: (f: string) => boolean | string,
): Choice[] {
  const choices: Choice[] = [];
  let currentFolder = '';
  for (const f of files) {
    const folder = path.dirname(f);
    if (folder !== currentFolder) {
      currentFolder = folder;
      choices.push({ name: `\x1b[2m── ${folder}/ ──\x1b[0m`, value: `__sep__${folder}`, checked: false, disabled: true });
    }
    const dis = isDisabled(f);
    choices.push({ name: path.basename(f), value: f, checked: isChecked(f), ...(dis ? { disabled: dis } : {}) });
  }
  return choices;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function runMakeConfig(): Promise<void> {
  const cfgPath = path.join(process.cwd(), 'typecon.json');
  const cur     = loadConfig(cfgPath);
  const locked  = new Set<string>(cur.locked ?? []);
  const cwd     = process.cwd();

  // ── Read-only header ──────────────────────────────────────────────────────
  console.log(`\n${C.cyan('── Project (read-only) ─────────────────────────────────────')}`);
  console.log(`  ${C.bold('Name')}:    ${cur.name ?? path.basename(cwd)}`);
  console.log(`  ${C.bold('Sources')}: ${(cur.sources ?? ['src/**/*.ts']).join(', ')}\n`);

  // ── Settings ─────────────────────────────────────────────────────────────
  console.log(C.cyan('── Settings ────────────────────────────────────────────────'));

  const settingFields = LOCKABLE_FIELDS.filter(f => f.key !== 'modules' && f.key !== 'locked');
  for (const { key, label } of settingFields) {
    if (locked.has(key))
      console.log(`  ${C.dim('[locked]')} ${label}: ${currentValue(cur, key as FieldKey)}`);
  }

  const unlocked = settingFields.filter(f => !locked.has(f.key));
  let a: any = {};
  if (unlocked.length > 0) {
    console.log('');
    // Inquirer treats dots as nested-object separators, so sanitize names to underscores.
    a = await inquirer.prompt(
      unlocked.map(({ key, label }) => {
        const pName  = key.replace(/\./g, '_');
        const val    = currentValue(cur, key as FieldKey);
        const isBool = key === 'defaultInclusion' || key === 'precompiledModules'
          || key === 'validate.enabled' || key === 'validate.warnNearLimits';
        return isBool
          ? { type: 'confirm', name: pName, message: `${label}:`, default: val === 'true' }
          : { type: 'input',   name: pName, message: `${label}:`, default: val };
      })
    );
  }

  // ── Module setup ──────────────────────────────────────────────────────────
  console.log(`\n${C.cyan('── Module setup ────────────────────────────────────────────')}`);

  const allFiles    = getModuleChoiceFiles(cur, cwd);
  const overrideMap = new Map<string, MakeModuleEntry>();
  for (const m of cur.modules ?? []) overrideMap.set(normalise(m.path), m);

  let newModules: MakeModuleEntry[] | undefined = cur.modules;

  if (allFiles.length === 0) {
    console.log(C.yellow('No source files found. Add entries to "sources" or "modules" in typecon.json.'));
  } else {
    const { configureModules } = await inquirer.prompt({
      type:    'confirm',
      name:    'configureModules',
      message: `${allFiles.length} module(s) found. Configure module settings?`,
      default: false,
    });

    if (configureModules) {
      const modulesLocked = locked.has('modules');

      // Step 1: enable / disable
      const { enabled } = await inquirer.prompt({
        type:     'checkbox',
        name:     'enabled',
        message:  'Enable/disable modules:',
        choices:  buildFolderChoices(
          allFiles,
          f => {
            const e = overrideMap.get(normalise(f));
            return e?.required === true || (e ? e.enabled : true);
          },
          f => {
            const e = overrideMap.get(normalise(f));
            return e?.required === true ? 'required' : false;
          },
        ),
        pageSize: Math.min(24, allFiles.length + Math.ceil(allFiles.length / 3) + 2),
      });

      const enabledSet   = new Set<string>((enabled as string[]).map(normalise));
      const enabledFiles = allFiles.filter(f => enabledSet.has(normalise(f)));

      // Step 2: required — skipped when 'modules' is locked
      let requiredSet = new Set<string>(
        [...overrideMap.values()].filter(m => m.required).map(m => normalise(m.path))
      );

      if (!modulesLocked && enabledFiles.length > 0) {
        console.log('');
        const { required } = await inquirer.prompt({
          type:     'checkbox',
          name:     'required',
          message:  'Which modules are required (cannot be disabled in tcc make config)?',
          choices:  buildFolderChoices(
            enabledFiles,
            f => requiredSet.has(normalise(f)),
            () => false,
          ),
          pageSize: Math.min(24, enabledFiles.length + Math.ceil(enabledFiles.length / 3) + 2),
        });
        requiredSet = new Set<string>((required as string[]).map(normalise));
      } else if (modulesLocked) {
        console.log(C.dim('  [locked] Required module status is frozen — only enable/disable is available.'));
      }

      newModules = allFiles.map(f => {
        const isRequired = requiredSet.has(normalise(f));
        if (isRequired) return { path: f, enabled: true, required: true };
        return { path: f, enabled: enabledSet.has(normalise(f)) };
      });
    }
  }

  // ── Lock management (hidden when 'locked' is itself locked) ───────────────
  let newLockedFields: string[] = cur.locked ?? [];

  if (!locked.has('locked')) {
    console.log(`\n${C.cyan('── Lock settings ───────────────────────────────────────────')}`);
    console.log(`Locked fields are displayed but not editable in ${C.cyan('tcc make config')}.\n`);

    const { lockedFields } = await inquirer.prompt({
      type:     'checkbox',
      name:     'lockedFields',
      message:  'Which fields should be locked?',
      choices:  LOCKABLE_FIELDS.map(({ key, label }) => ({
        name:    label,
        value:   key,
        checked: locked.has(key),
      })),
      pageSize: LOCKABLE_FIELDS.length + 2,
    });

    newLockedFields = lockedFields as string[];
  }

  // ── Write back ────────────────────────────────────────────────────────────
  // Keys were sanitized (dots → underscores) before being passed to inquirer.
  const pKey    = (key: string) => key.replace(/\./g, '_');
  const getStr  = (key: string, fallback: string)  => a[pKey(key)] !== undefined ? String(a[pKey(key)])   : fallback;
  const getBool = (key: string, fallback: boolean)  => a[pKey(key)] !== undefined ? Boolean(a[pKey(key)]) : fallback;
  const rawBaseDirs: string = a[pKey('validate.baseDirs')] ?? '';

  const updated: MakeConfig = {
    name:    cur.name,
    sources: cur.sources,
    objDir:     locked.has('objDir')    ? (cur.objDir    ?? 'obj')      : getStr('objDir',    cur.objDir    ?? 'obj'),
    outputDir:  locked.has('outputDir') ? (cur.outputDir ?? 'compiled') : getStr('outputDir', cur.outputDir ?? 'compiled'),
    output:     locked.has('output')    ? (cur.output    ?? 'GAME.CON') : getStr('output',    cur.output    ?? 'GAME.CON'),
    stackSize:      locked.has('stackSize')      ? (cur.stackSize      ?? 1024) : (parseInt(a[pKey('stackSize')])      || cur.stackSize      || 1024),
    heapPageSize:   locked.has('heapPageSize')   ? (cur.heapPageSize   ?? 4)    : (parseInt(a[pKey('heapPageSize')])   || cur.heapPageSize   || 4),
    heapPageNumber: locked.has('heapPageNumber') ? (cur.heapPageNumber ?? 128)  : (parseInt(a[pKey('heapPageNumber')]) || cur.heapPageNumber || 128),
    defaultInclusion:   locked.has('defaultInclusion')   ? (cur.defaultInclusion   ?? false) : getBool('defaultInclusion',   cur.defaultInclusion   ?? false),
    precompiledModules: locked.has('precompiledModules') ? (cur.precompiledModules ?? true)  : getBool('precompiledModules', cur.precompiledModules ?? true),
    modules: newModules,
    locked:  newLockedFields.length > 0 ? newLockedFields : undefined,
    validate: {
      enabled:        locked.has('validate.enabled')        ? (cur.validate?.enabled        ?? true) : getBool('validate.enabled',        cur.validate?.enabled        ?? true),
      warnNearLimits: locked.has('validate.warnNearLimits') ? (cur.validate?.warnNearLimits ?? true) : getBool('validate.warnNearLimits', cur.validate?.warnNearLimits ?? true),
      baseDirs: locked.has('validate.baseDirs')
        ? (cur.validate?.baseDirs ?? [])
        : rawBaseDirs.split(',').map((s: string) => s.trim()).filter(Boolean),
    },
  };

  fs.writeFileSync(cfgPath, JSON.stringify(updated, null, 2));
  console.log(`\n${C.green('typecon.json updated!')}`);
}

function normalise(p: string) { return p.replace(/\\/g, '/'); }

function sortByFolder(files: string[]): string[] {
  return [...files].sort((a, b) => {
    const da = path.dirname(a), db = path.dirname(b);
    return da !== db ? da.localeCompare(db) : path.basename(a).localeCompare(path.basename(b));
  });
}
