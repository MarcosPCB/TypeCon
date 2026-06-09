# Changelog

## [v0.8.3]

### Added
- **CON VM Simulator (`tcc -S`)**: Full CON bytecode interpreter (`src/modules/con-vm/`) with Parser, Interpreter, Memory, and Tables modules. Supports ~50 CON opcodes: arithmetic, array ops, conditionals, while/switch, state calls, string ops (`qputs`/`qstrcpy`/`qsprintf`), `getangle`, `mulscale`/`divscale`, `sqrt`, `sin`/`cos` via Build Engine sintable. Unified `flat[]` memory model with overflow detection and peak tracking.
  - CLI flags: `-S`/`--sim` (run simulator), `--state NAME` (run specific defstate), `--no-init` (skip init events), `--mem` (print memory report).
  - `--mem` report shows per-phase stack HWM and page-based heap accounting: Allocated live / Marked to be freed / Free reclaimed.
  - Game struct fields: `actorFields`, `playerFields`, `sectorFields`, `wallFields` in `VMState` — pre-seeded via `--set-field-actor/player/sector/wall` CLI flags (`[INDEX]field=value` syntax).
  - `readarrayfromfile` / `writearraytofile` native override in the simulator.
  - `ifhitweapon` instruction support.
- **Debug-Test Framework**: A `// debug-test` comment on a `CEvent`/method `Append()` enables in-place pass/fail tracking.
  - Compiler emits `//// DEBUG-TEST ////` CON marker, `state _testInit`, and per-call `_testCounter` increments.
  - `checkEq(a, b)` and `checkFpEq(a, b)` calls count total tests and passes; `_testCounter` encodes `(total << 12) | passed`.
  - `--test` CLI flag: prints `[PASS]/[FAIL]` per function, aggregates totals across all tested defstates, exits `0`/`1`.
- **`tcc test` runner** (new module: `src/modules/test-runner/`): multi-scenario JSON test runner that compiles, links, simulates, and asserts in one command.
  - Test script format (`.test.json`): `setup` block pre-seeds struct fields per scenario; `expect` block runs post-simulation assertions (`eq`/`ne`/`gt`/`lt`/`ge`/`le`) on game vars and struct fields.
  - Supports `linePrint`, `defaultInclusion`, `memTest`, and `validate` fields per script.
  - Reference scripts: `examples/actors/AssaultTrooper.test.json`, `examples/tests/json/test_json.test.json`.
- **Native `Record<string, T>` hash map**: Compiler detects `Record<string, T>` type annotations and automatically emits `_rec_alloc` hash-table setup code. Compile-time FNV-1a hashing for string-literal keys. `ESymbolType.record` added; `SymbolDefinition` extended with `record_value_type` and `record_value_fpbits`. Chained access (`r["a"]["b"]`) emits all `_rec_get` calls correctly.
- **`JSON` namespace alias** (`src/sets/TCSet100/JSON.ts`): mirrors JavaScript's `JSON` global.
  - `JSON.parse(text)` → `new CJson(text)`
  - `JSON.stringify(obj)` → `obj.Stringify()`
- **CFile + CJson integration**: Full `CFile.Read → CJson` pipeline; `CJson.ToRecord()` supports recursive nested object → `Record<string, number>` conversion.
- **Explicit FP cast functions**: `FP11(x)`, `FP14(x)`, `FP16(x)`, `FP30(x)` — shift int→FP or FP→FP with correct precision. Declared in `types.ts` and handled in `visitCallExpression`.
- **Float literal auto-scaling**: Float literals with a decimal point (e.g. `90.0`, `2.0`) now scale to the ambient FP precision in all visitors instead of being emitted as raw integers. Literals without FP context default to FP16.
- **FP→int auto-truncation**: Assignment `x = y` or `let x: number = y` where `y` is an FP value emits `shiftr ra N`; compile-time constant FP identifiers resolved at compile time.
- **Multi-file compilation context isolation**: Default fresh context per file with import-cache deduplication (no symbol bleed). `-sc` opts into full context sharing; `-sep` remains fully independent per file.

### Changed
- `templates/` directory renamed to `examples/`.
- `-C` clean command now deletes only specific file types (`*.tco`, `*.icc`, `*.con`) rather than emptying directories entirely. `-C precompiled` also cleans `precompile/generated/*.con`.
- `run_tests` scripts renamed to `run-tests` (both `.sh` and `.bat`).
- `CRecord.ts` removed; superseded by native `Record<string, T>` support.
- FP precision mismatch errors downgraded to warnings with automatic coercion (`shiftr`/`shiftl`) emitted.
- `AnimUtils.pingPong`: rewrote with correct all-integer algorithm. `easeInSine`/`easeOutSine`/`easeInOutSine` updated to use explicit FP14↔FP16 casts.

### Fixed
- **Linker**: `sortDefstates` now places `appendstate`/`prependstate` blocks after all `defstate` definitions, eliminating `WARN_FORWARD_STATE` forward-reference warnings.
- **Compiler — visitMemberExpression**: array-type class field assignment generated a load instead of a store; chained `Record` access now generates all `_rec_get` calls; `_rec_hash` no longer corrupts `ra` (saves `r2=ra` immediately after `pushr3`).
- **Compiler — visitLeafOrLiteral**: `new ClassName()` with 0 arguments no longer emits nonexistent `pushr0`/`popr0`.
- **Compiler — visitCallExpression**: native arg 0 for stack-frame locals now correctly lands in `r0`.
- **Compiler — visitClassDeclaration / visitMethodDeclaration**: method pre-registration now sets `returns` for forward calls; primitive-returning methods correctly get `returns = ESymbolType.number`.
- **Compiler — visitVariableDeclaration**: `Record<string, T>` with a non-literal initializer no longer ignores the right-hand side.
- **Compiler — visitReturnStatement**: class return type corruption fixed — `|=` into an already-set class type no longer produces a mixed bit value (e.g. 257 from 256|1).
- **Compiler — visitWhileStatement**: tracks `localVarCount` for variables declared inside the loop body; emits `sub rsp N` at loop end to keep the stack stable across iterations.
- **Compiler — path normalization**: `src/sets/TCSet100/` and `include/TCSet100/` now share one cache key, preventing duplicate imports.
- **CON VM Parser**: support for old-style `switch…endswitch` (used in `CFile` `CONUnsafe` blocks); `break` inside old-style switch cases no longer exits the event body early; `getarraysize` argument order fixed.
- **CON VM Interpreter**: `CFile_GetBuffer` native override fixes off-by-one from `BufferToSourceIndex`.
- **CON VM actorHelper**: `FindLabel` guarded against empty segments after this-shift.
- **CJson**: `GetBool()`/`GetNumber()` `CONUnsafe` implementations corrected to preserve `rb`; Stringify inner loop uses `r10` as stable `obj_ptr` copy since `ri` is clobbered by the inner hash-query loop.
- **CJson `ToRecord`**: `Find(k)` now called before the if-else so both branches push equally (stack balance fix); `_rec_alloc` passes block size (not capacity) to `state alloc`.
- **Game struct properties**: Corrected field list for `CPlayer`, `TSprite`, and `userdef`.
- **Validator**: float literal detection (`ERROR_FLOAT_LITERAL` when a float appears in raw CON output); `ERROR_ARRAY_ARITH_DST` for arithmetic ops with array-element destinations; forward-reference handling no longer emits false-positive errors for `state` calls to as-yet-undefined `defstate`s.

## [v0.8.2]

### Added
- **Make Module (`tcc make`)**: Project-level build orchestrator driven by `typecon.json`. Replaces manual flag chaining with a single command that runs the full compile → link → validate pipeline.
  - `tcc make create` — interactive wizard that generates a new `typecon.json` from scratch (project name, source globs, output paths, stack/heap sizes, validator settings, per-module enable/required flags, and field lock configuration).
  - `tcc make config` — reconfigures an existing `typecon.json`; `name` and `sources` are always read-only; all other fields are editable unless listed in `locked[]`.
  - `tcc make` — runs the full pipeline (compile → link → validate). Does **not** clean first.
  - `tcc make clear` / `tcc make clean` — empties `obj/`, `asm/`, and `compiled/` without building.
  - `tcc make compile` / `tcc make link` / `tcc make validate` — run individual pipeline steps.
- **`typecon.json` project config**: Per-project build file with fields for `name`, `sources` (glob array), `objDir`, `outputDir`, `output`, `stackSize`, `heapPageSize`, `heapPageNumber`, `defaultInclusion`, `precompiledModules`, `modules[]` (per-file enable/required overrides), `validate{}`, and `locked[]`.
- **Lockable fields**: Any field key listed in `locked[]` is displayed but not editable in `tcc make config`. The `locked` key itself can be locked ("lock-locked"), hiding the lock management section entirely.
- **Required modules**: `modules[]` entries with `required: true` cannot be disabled in `tcc make config`. When `"modules"` is in `locked[]`, only enable/disable is available — the required-status checkbox is hidden.
- **Folder-grouped module UI**: Module checkboxes in `tcc make create` and `tcc make config` are sorted by folder with visual `── folder/ ──` separators for large projects.
- **`typecon.example.json`**: Reference config file added to the repo showing all available fields.
- **EDuke32 event system expansion**: All 164 EDuke32 events now mapped across 6 categories — PAE (25 Per-Actor Events), DE (33 Duke Events), IE (24 Input Events), WE (28 World Events), PIE (11 Per-Item Events), ME (43 Misc Events).
- **Validator per-file delta stats**: `IncludedFileResult` now tracks symbol deltas per included file — defines, actions, moves, AIs, quotes, and aggregate symbol count added by each `include` directive.
- **Validator symbol-type tracking**: Validator reports on `defines`, `actions`, `moves`, `ais`, and `quotes` usage alongside the existing label/game-var counts, with near-limit warnings for each category.
- **Templates reorganization**: Template files reorganized into category subdirectories under `templates/` (actors, tests/events, tests/general, tests/input, tests/math, tests/singletons, tests/structs).

## [v0.8.0]

### Added
- **FP11, FP14, FP30 precision types**: New fixed-point types alongside FP16 — FP11 (BAM angles, 1.0 = 2048), FP14 (sin/cos values, 1.0 = 16384), FP30 (unit range, 1.0 = 1073741824).
- **Typed sin/cos/tan**: `Math.sin` and `Math.cos` now accept `FP11` angles and return `FP14`; `Math.tan` gains three dispatch variants for raw BAM, FP11, and FP16 degree inputs.
- **FP conversion helpers**: `intToFP11/14/30`, `fp11/14/30ToInt`, `fp11/14/30Raw`, `fp11/14/30ToString` added to the standard library.
- **FP toString defstates**: `_convertFP11ToString`, `_convertFP14ToString`, `_convertFP30ToString` in the VM framework (convert to FP16 scale then delegate to `_convertFP2String`).
- **`RotateSpriteF`**: Full-precision `rotatesprite` variant — x/y as normalized FP16 [0.0–1.0] screen coordinates (mapped to 20971520×13107200 FULL16 space), angle as FP11, `ROTATESPRITE_FULL16` set automatically.
- **`ScreenTextF`**: Full-precision `screentext` variant — same normalized x/y convention, block and character angles as FP11, `ROTATESPRITE_FULL16` set automatically.

### Changed
- `FP_ALIAS_BITS` updated throughout the compiler (Compiler.ts, all visitor services) to recognise the four valid precisions: 11, 14, 16, 30.
- Branded intersection FP types (e.g. `number & { __brand }`) no longer trigger spurious "Undeclared type alias" warnings.

### Removed
- Removed `FP8` and `FP12` precision types — only FP11, FP14, FP16, and FP30 are supported.

### Fixed
- Fixed `_convertFP2String` crash when value is a round number (missing `0000` fractional part).
- Fixed `_convertFP2String` ignoring integral part of 0 and returning an inverted string.
- Fixed `state realloc` bad data copy (wrong source memory address).
- Fixed `_printFlatStr` logging incorrect memory location.
- Fixed `_convertString2Quote` missing boundary checks for invalid quote indices.

## [v0.7.0]

### Added
- **Separate Compilation & Linking**: Introduced the `Linker` module and `.tco` intermediate format.
- **Project Structure**: Revamped `setup` command with template support and VS Code plugin automatic configuration.
- **Relocatable CON Modules**: Added support for generating relocatable modules with global array storage.
- **Enhanced CLI**: 
  - New `-L, --linker` for combining intermediate files.
  - New `-ic, --intermediate-code` for raw CON output.
  - New `-sep, --separate` for modular linking.
  - New `-m, --module` for explicit module-mode compilation.
  - New `-C, --clean` for project cleanup.
- **Modern JS Operators**: Added support for **Spread Operator (...)** in object and array literals.
- **Documentation**: Comprehensive [Technical Architecture](Architecture.md) guide covering memory, strings, and module sets.

### Changed
- Improved garbage collection efficiency and stack management.
- Revamped `CFile` and `DN3D` module integration for better performance.
- Simplified CLI flags for better readability and alias support (e.g., `-dl` for `-lp`).

### Fixed
- Fixed circular dependency issues in multi-file project compilation.
- Resolved various member expression transpilation bugs within actor classes.
- Fixed: Language set markers (`LANGUAGE_SET_VERSION`, `LANGUAGE_SET`) now correctly only appear in the project header and are omitted from individual compiled modules.


## [v0.6.0]

### Fixed
- Fixed creating init files with wrong names.
- Fixed files section at package.json.
- Fixed copying include files path.
- Fixed not creating the generated folder at the precompiled modules.
- Fixed evaluateLiteralExpression not taking constants into account.
- Fixed native structure variables override_code not setting up properly the current player index.
- Fixed evaluateLiteralExpression not properly evaluating the symbols in the compiler's context.
- Fixed visitMemberExpression not compiling when an array is found inside a nested object (native).
- Fixed native objects not working when inside actor class using this.
- Fixed not logging when input file wasn't found.
- Fixed PrintStackAndHeap not checking if the current stack is not greater than the available memory.

### Added
- Added documentation about installing it globally.
- Added the constant definition of the Assault Trooper picnum to the template.
- Added complete list of properties for CPlayer.
- Implemented for CPlayer: weaponSystem, pos, previousPos, vel, currSector,curSectorID, ang, previousAng, angVel, horiz, horizOff,verticalAngle, verticalAngleOff.
- Added symbol_print for printing symbols in CLI.
- Added isPlayer to CompilerContext.
- Added version check.
- Added --heap_size or -hs CLI to define the heap size.
- Added more events to the event list.
- Added the proper objects for each weapon variables.
- Started working on a proper New Weapon System.
- Added instructions on how to get started.

### Changed
- Changed lineDetail to line_print.
- Refactored the heap memory system: every page has a minimum size of PAGE_SIZE and a maximum of 4 GB. This way the entire system for memory allocation, deallocation and the Garbage Collector is more efficient with fewer loops.

### Removed
- Removed pkg (not working as intended).
- Removed old references to NWS.
- Removed unused code for the debug mode.
- Removed debugger module references.
