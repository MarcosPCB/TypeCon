# CON VM Module Skill

The `src/modules/con-vm` module is a TypeScript interpreter for linked TypeCON output. It simulates the CON runtime (registers, `flat[]` memory, game structures) without running EDuke32, enabling automated testing and debugging of compiled code.

## Core Files

| File | Purpose |
|---|---|
| `index.ts` | Entry point: `runVM()`, execution phase orchestration, memory/test reporting |
| `Parser.ts` | `CONParser` — tokenizes CON source and builds a `Statement[]` AST |
| `Interpreter.ts` | `executeStatements()` — recursive statement executor |
| `Memory.ts` | `VMState` type — all mutable runtime state (vars, arrays, quotes, game structures) |
| `Types.ts` | `Statement` union type (40+ ops), `Operand` variants, `ConditionalOp` enum |
| `Tables.ts` | Build Engine sine table (2048 entries), `mulscale`, `divscale`, `buildSqrt` |

## Entry Point

```typescript
runVM(source: string, opts?: VMRunOptions): VMRunResult
```

`VMRunOptions` key fields:

| Field | Purpose |
|---|---|
| `entryState` / `entryEvent` / `entryActor` | Phase 3 entry point |
| `noInit` | `true` → skip phases 1 and 2 entirely |
| `testMode` | Collect `@DebugTest` results and set exit code |
| `showMemory` | Print heap/stack memory report after execution |
| `searchDirs` | Directories to search for `include` files |
| `actorFields` / `playerFields` / `sectorFields` / `wallFields` | Pre-seed game structure fields |

`VMRunResult`: `{ exitCode: number, vars, actorFields, playerFields, sectorFields, wallFields }`

## Execution Phases

1. **Phase 1** — Top-level init statements (gamevar/gamearray declarations, `definequote`)
2. **Stack limit** — Set from `rds` variable (stack base + global static size)
3. **Snapshot 1** — Baseline memory peak after init
4. **Phase 2** — Bootstrap event sequence: `EVENT_INIT → EVENT_INITCOMPLETE → EVENT_SETDEFAULTS → EVENT_NEWGAME`
5. **Snapshot 2** — Memory peak after bootstrap
6. **Phase 3** — User entry point (`entryActor | entryEvent | entryState`)
7. **Reporting** — Memory report (if `showMemory`) and test summary (if `testMode`)

`noInit: true` skips phases 1–2; useful for unit-testing a single `defstate` in isolation.

## Runtime Limits

| Limit | Value | Behavior on breach |
|---|---|---|
| Recursion depth | 500 | Logs error, throws |
| Step counter | 10,000,000 | Logs error, aborts execution |
| Array index < 0 | — | Logged error, returns 0 |
| Array index > 20M | — | Logged error, no write |
| Array out-of-bounds read | — | Returns 0 (silent) |
| Stack overflow (`rsp >= rds`) | — | Warns, execution continues |

## Fixed-Point Math

All fixed-point operations use 64-bit `BigInt` intermediates to match EDuke32 exactly:

| Function | Formula | Use |
|---|---|---|
| `mulscale(a, b, scale)` | `(a * b) >> scale` | Fixed-point multiply |
| `divscale(a, b, scale)` | `(a << scale) / b` | Fixed-point divide |
| `sin/cos(angle)` | Lookup in 2048-entry sintable | Angles 0–2047 (1024 = 180°) |
| `getangle(dx, dy)` | `atan2(dy, dx)` → 0–2047 | Direction to angle |

The sine table range is −16384 … +16384 (matching `FP14` precision).

## Control Flow Signals (Exceptions)

| Signal | TypeScript class | CON keyword | Effect |
|---|---|---|---|
| `ExitStateSignal` | — | `terminate` | Exits the current `defstate` |
| `BreakSignal` | — | `exit` | Exits the current loop |
| `ContinueSignal` | — | `continue` | Next loop iteration |
| `TerminateSignal` | — | `break` | Exits the current actor/event |

## Test Mode (`testMode: true`)

`@DebugTest` markers in CON source set `op: 'marker'` statements. When the VM hits a marker:
- Collects test results from the `rb` register
- `total = rb >>> 12`, `passed = rb & 0xFFF`
- Exit code `0` if all passed, `1` if any failed
- Results printed as color-coded `[PASS]` / `[FAIL]` lines

## Memory Profiling (`showMemory: true`)

Prints per-phase peak tracking:
- Peak `rsp` (stack high-water mark)
- Peak `flat[]` index used
- Heap page analysis via `allocTable`: live pages, marked-to-free, reclaimed (with word/byte counts)

## Key Statement Notes

- `state NAME` — recursive call; depth-tracked; unknown state → warning, not error
- `echo Q` / `addlogvar VAR` — print quote or variable value to console
- `marker` — test boundary; triggers `@DebugTest` result collection
- `ifhitweapon` — reads `htextra` from actor, subtracts damage, executes body if hit
- `readarrayfromfile` / `writearraytofile` — real filesystem I/O using 4-byte-per-int32 little-endian packing
- `defstate` inside code — runtime state definition; stored in `stateMap` for later calls

## Agent Guidelines
- The VM covers the TypeCON runtime subset — it is **not** a full EDuke32 emulator. Features like `spawn`, `shoot`, graphics, or sound do not execute.
- `CFile_GetBuffer` has a **native override** in `Interpreter.ts` that corrects an off-by-one in the compiled output. Do not remove this override.
- When a test produces unexpected values, check phase 2 bootstrap events first — they mutate VM state even without `noInit: false` explicitly set.
- Game structure fields (`sprites[i].x`, `players[i].health`) default to `0` in the sparse Maps. Use `VMRunOptions.actorFields` etc. to pre-seed them for realistic test scenarios.
- `flat[]` auto-grows on write but EDuke32 requires an explicit `resizearray` first — the VM logs a warning when growth happens without a prior resize.
- For debugging a specific state, set `noInit: true` and `entryState: 'myState'` — this skips all event bootstrapping and runs only the target.
