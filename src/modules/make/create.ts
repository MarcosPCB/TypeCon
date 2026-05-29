import * as fs   from 'fs';
import * as path from 'path';
import inquirer  from 'inquirer';
import { MakeConfig, MakeModuleEntry } from './types';
import { expandSourceGlobs } from './index';

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
];

export async function runMakeCreate(): Promise<void> {
  const cfgPath = path.join(process.cwd(), 'typecon.json');

  if (fs.existsSync(cfgPath)) {
    const { overwrite } = await inquirer.prompt({
      type: 'confirm',
      name: 'overwrite',
      message: 'typecon.json already exists — overwrite?',
      default: false,
    });
    if (!overwrite) { console.log('Aborted.'); return; }
  }

  const a = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: path.basename(process.cwd()),
    },
    {
      type: 'input',
      name: 'sources',
      message: 'Source glob pattern(s) — comma-separated (e.g. src/**/*.ts):',
      default: 'src/**/*.ts',
    },
    {
      type: 'input',
      name: 'objDir',
      message: 'Object output directory:',
      default: 'obj',
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Compiled output directory:',
      default: 'compiled',
    },
    {
      type: 'input',
      name: 'output',
      message: 'Output CON file name:',
      default: 'GAME.CON',
    },
    {
      type: 'input',
      name: 'stackSize',
      message: 'Virtual stack size:',
      default: '1024',
    },
    {
      type: 'input',
      name: 'heapPageSize',
      message: 'Heap page size:',
      default: '4',
    },
    {
      type: 'input',
      name: 'heapPageNumber',
      message: 'Heap page count:',
      default: '128',
    },
    {
      type: 'confirm',
      name: 'defaultInclusion',
      message: 'Include default GAME.CON?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'precompiledModules',
      message: 'Include pre-compiled system modules?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'validateEnabled',
      message: 'Run validator after link?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'warnNearLimits',
      message: 'Warn when approaching EDuke32 resource limits?',
      default: true,
      when: (ans: any) => ans.validateEnabled,
    },
    {
      type: 'input',
      name: 'baseDirs',
      message: 'Validator CON include dirs — comma-separated:',
      default: 'baseCON',
      when: (ans: any) => ans.validateEnabled,
    },
  ]);

  // ── Module setup ──────────────────────────────────────────────────────────
  const sourcesArray = a.sources.split(',').map((s: string) => s.trim()).filter(Boolean);
  const cwd          = process.cwd();
  const tempCfg: MakeConfig = { sources: sourcesArray };
  const allFiles     = expandSourceGlobs(tempCfg, cwd);

  let modules: MakeModuleEntry[] | undefined;

  if (allFiles.length > 0) {
    console.log('\n\x1b[36m── Module setup ────────────────────────────────────────────\x1b[0m\n');

    const { configureModules } = await inquirer.prompt({
      type: 'confirm',
      name: 'configureModules',
      message: `${allFiles.length} source file(s) found. Configure module settings now?`,
      default: false,
    });

    if (configureModules) {
      const sorted = sortByFolder(allFiles);

      // Step 1: enable / disable
      const { enabled } = await inquirer.prompt({
        type:     'checkbox',
        name:     'enabled',
        message:  'Enable/disable modules (all enabled by default):',
        choices:  buildFolderChoices(sorted, () => true, () => false),
        pageSize: Math.min(24, sorted.length + Math.ceil(sorted.length / 3) + 2),
      });

      // Step 2: mark required (only among enabled files)
      const enabledSet  = new Set<string>((enabled as string[]).map(normalise));
      const enabledFiles = sorted.filter(f => enabledSet.has(normalise(f)));

      let requiredSet = new Set<string>();
      if (enabledFiles.length > 0) {
        const { required } = await inquirer.prompt({
          type:     'checkbox',
          name:     'required',
          message:  'Which modules are required (cannot be disabled in tcc make config)?',
          choices:  buildFolderChoices(enabledFiles, () => false, () => false),
          pageSize: Math.min(24, enabledFiles.length + Math.ceil(enabledFiles.length / 3) + 2),
        });
        requiredSet = new Set<string>((required as string[]).map(normalise));
      }

      modules = sorted.map(f => {
        const isEnabled  = enabledSet.has(normalise(f));
        const isRequired = requiredSet.has(normalise(f));
        if (isRequired) return { path: f, enabled: true, required: true };
        return { path: f, enabled: isEnabled };
      });
    }
  }

  // ── Lock management ───────────────────────────────────────────────────────
  console.log('\n\x1b[36m── Lock settings ───────────────────────────────────────────\x1b[0m');
  console.log('Locked fields are displayed but not editable in \x1b[36mtcc make config\x1b[0m.\n');

  const { lockedFields } = await inquirer.prompt({
    type:     'checkbox',
    name:     'lockedFields',
    message:  'Which fields should be locked?',
    choices:  LOCKABLE_FIELDS.map(({ key, label }) => ({ name: label, value: key, checked: false })),
    pageSize: LOCKABLE_FIELDS.length + 2,
  });

  const cfg: MakeConfig = {
    name:              a.name,
    sources:           sourcesArray,
    objDir:            a.objDir,
    outputDir:         a.outputDir,
    output:            a.output,
    stackSize:         parseInt(a.stackSize)      || 1024,
    heapPageSize:      parseInt(a.heapPageSize)   || 4,
    heapPageNumber:    parseInt(a.heapPageNumber) || 128,
    defaultInclusion:  a.defaultInclusion,
    precompiledModules: a.precompiledModules,
    modules,
    validate: {
      enabled:        a.validateEnabled,
      warnNearLimits: a.warnNearLimits ?? true,
      baseDirs:       a.baseDirs
        ? a.baseDirs.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
    },
    locked: (lockedFields as string[]).length > 0 ? lockedFields as string[] : undefined,
  };

  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  console.log(`\n\x1b[32mtypecon.json created!\x1b[0m`);
  console.log(`Run \x1b[36mtcc make config\x1b[0m to adjust settings or module toggles at any time.`);
  console.log(`Run \x1b[36mtcc make\x1b[0m to build your project.`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalise(p: string) { return p.replace(/\\/g, '/'); }

function sortByFolder(files: string[]): string[] {
  return [...files].sort((a, b) => {
    const da = path.dirname(a), db = path.dirname(b);
    return da !== db ? da.localeCompare(db) : path.basename(a).localeCompare(path.basename(b));
  });
}

type Choice = { name: string; value: string; checked: boolean; disabled?: string | boolean };

function buildFolderChoices(
  files: string[],
  isChecked: (f: string) => boolean,
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
