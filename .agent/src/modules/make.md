# Make Module Skill

The `src/modules/make` module is the project-level build system for TypeCON. It reads a `typecon.json` config file and orchestrates the full compile → link → validate pipeline. Also provides interactive CLI wizards for creating and editing project configs.

## Core Files

| File | Purpose |
|---|---|
| `index.ts` | `runMake()` pipeline orchestrator + `loadConfig()` + glob expansion + `resolveSourceFiles()` |
| `config.ts` | `runMakeConfig()` — interactive prompts to edit an existing `typecon.json` |
| `create.ts` | `runMakeCreate()` — wizard to generate a new `typecon.json` from scratch |
| `types.ts` | `MakeConfig`, `MakeModuleEntry`, `MakeValidateConfig` interfaces |

## CLI Commands

| Command | Action |
|---|---|
| `tcc make` | Run the full `all` pipeline (compile + link + validate) |
| `tcc make compile` | Compile `.ts` sources → `.tco` objects only |
| `tcc make link` | Link `.tco` objects → final `.con` only |
| `tcc make validate` | Validate the linked `.con` file only |
| `tcc make clean` | Delete all `.tco`, `.con`, and `.icc` build artifacts |
| `tcc make create` | Interactive wizard to create `typecon.json` |
| `tcc make config` | Interactive wizard to edit `typecon.json` |

## Config Schema (`typecon.json`)

| Field | Default | Purpose |
|---|---|---|
| `name` | dir name | Project display name |
| `stackSize` | `1024` | VM stack region size |
| `heapPageSize` | `4` | Heap allocation unit (words) |
| `heapPageNumber` | `128` | Maximum heap pages |
| `objDir` | `obj` | Directory for `.tco` intermediate files |
| `outputDir` | `compiled` | Directory for final `.con` output |
| `output` | `GAME.CON` | Output filename |
| `defaultInclusion` | `false` | Prepend `include GAME.CON` to output |
| `precompiledModules` | `false` | Include pre-compiled system helper states |
| `sources` | `["src/**/*.ts"]` | Glob patterns for source discovery |
| `modules[]` | `[]` | Per-file enable/disable/required overrides |
| `validate.enabled` | `true` | Run validator after link step |
| `validate.warnNearLimits` | `false` | Warn when approaching EDuke32 resource limits |
| `validate.baseDirs` | `[]` | Additional directories for include resolution |
| `locked[]` | `[]` | Fields frozen in the config UI (read-only) |

`modules[]` entries: `{ path: string, enabled: boolean, required?: boolean }` — `required: true` prevents disabling in the interactive config UI.

## Pipeline (`runMake`)

### compile step
1. `resolveSourceFiles(cfg, cwd)` — expands `sources` globs, filters by `modules[]` enable/disable state
2. Creates `TsToConCompiler` with `mode: 'module'`, `lineDetail: false`
3. Compiles each enabled file, sharing a single `CompilerContext` across all
4. Writes `.tco` JSON files to `objDir`

### link step
1. Loads all `.tco` files from `objDir` into `Linker`
2. Creates `CONInit(stackSize, heapPageSize, heapPageNumber, precompiledModules)`
3. Runs `Linker.link()` to produce unified CON code
4. Optionally prepends `include GAME.CON` if `defaultInclusion: true`
5. Writes to `outputDir/output`

### validate step
1. Reads the final linked `.con` file
2. Calls `validateCON(text, { baseDirs: [...validate.baseDirs, outputDir] })`
3. Prints diagnostics (red = errors, yellow = warnings)
4. Exits with code 1 if any errors found

## Agent Guidelines
- Memory defaults here (`stackSize: 1024, heapPageNumber: 128`) are intentionally smaller than the test-runner (`8192 / 14336`). Do not change one without considering the other.
- `resolveSourceFiles()` is the single source of truth for which files get compiled. When debugging "file not compiled", check whether it is excluded by a `modules[]` entry or not matched by `sources` globs.
- To add a new build step, add a case to the `switch` in `runMake()` in `index.ts` and add a corresponding CLI handler in `main.ts`.
- The `locked[]` field in `typecon.json` prevents fields from being edited via `tcc make config` — useful for team projects where stack/heap sizes must not drift.
- After any config change, commit the updated `typecon.json` — it is the project's build contract.
