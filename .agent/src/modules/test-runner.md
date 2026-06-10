# Test Runner Module Skill

The `src/modules/test-runner` module compiles TypeScript sources, validates them, runs them in the CON VM, and checks assertions against the resulting VM state. It is the primary way to write automated tests for TypeCON code.

## Entry Points

| Function | Input | Use case |
|---|---|---|
| `runTestScript(jsonPath, pkgDir)` | Path to a `.json` test suite | Multi-test suite with setup/expect assertions |
| `runTestTs(tsPath, pkgDir)` | Path to a single `.ts` file | Quick single-file test with memory report |

Both are called from the `tcc test <path>` CLI command. The extension of `<path>` determines which is used.

## JSON Test Suite Format

```json
{
  "name": "Suite Name",
  "source": ["src/actor.ts"],
  "validate": true,
  "memTest": false,
  "linePrint": false,
  "tests": [
    {
      "name": "Test case name",
      "runActor": "50",
      "noInit": false,
      "setup": {
        "actorFields": { "0": { "health": 100 } }
      },
      "expect": {
        "vars": { "myVar": { "eq": 42 } },
        "actorFields": { "0": { "health": { "ge": 50 } } }
      }
    }
  ]
}
```

### `TestCase` fields

| Field | Purpose |
|---|---|
| `runActor` | Entry point: `actor`/`useractor` for tile PICNUM (string) |
| `runEvent` | Entry point: event handler (e.g. `"EVENT_NEWGAME"`) |
| `runState` | Entry point: named `defstate` |
| `noInit` | `true` → skip EVENT_INIT→EVENT_NEWGAME bootstrap phases |
| `setup` | Pre-seed actor/player/sector/wall fields before execution |
| `expect` | Post-execution assertions (see below) |

Entry point priority: `runActor > runEvent > runState`. A case with no entry point is silently skipped.

### Assertion operators (`AssertOp`)
Each expected value can be a bare number (equality) or an object with one operator key:
- `{ eq: N }` — equal
- `{ ne: N }` — not equal
- `{ gt: N }` — greater than
- `{ lt: N }` — less than
- `{ ge: N }` — greater or equal
- `{ le: N }` — less or equal

`expect` supports: `vars`, `actorFields`, `playerFields`, `sectorFields`, `wallFields`.

## Execution Flow

1. **Compile** all `source[]` files with large memory (`stackSize: 8192, heapNumPages: 14336`) → `.tco` files
2. **Link** via `Linker` + `CONInit` → final `.con`
3. **Validate** via `validateCON()` (unless `validate: false`) — aborts suite on errors
4. **For each test case**:
   - Call `runVM(source, { entryPoint, noInit, testMode: true, setup overrides })`
   - Check VM exit code: `0` = all `@DebugTest` assertions in CON source passed
   - Evaluate all `expect` assertions against returned VM state
   - Record `[PASS]` / `[FAIL]` with failure details
5. **Print summary table** — exits with code 1 if any test failed

## VM Exit Code Encoding

The `rb` register encodes `@DebugTest` results:
- `total = rb >>> 12`
- `passed = rb & 0xFFF`
- Exit code `0` → `total === passed` (all passed)
- Exit code `1` → at least one assertion failed

Non-zero exit code means the CON-level assertion check failed, independent of JSON `expect` assertions.

## Memory Defaults

The test runner intentionally uses much larger memory than the `make` pipeline:

| Setting | Test runner | make pipeline |
|---|---|---|
| `stackSize` | `8192` | `1024` |
| `heapNumPages` | `14336` | `128` |

This allows more complex simulations without hitting stack or heap limits during testing.

## Include Search Directories

The runner looks for included CON files in:
1. `<cwd>/baseCON/`
2. `<pkgDir>/../baseCON/`
3. The output directory (where the linked `.con` was written)

## Agent Guidelines
- `noInit: true` skips the full bootstrap (phases 1 and 2 of the VM); use it for unit-testing a single isolated `defstate` without side effects from `EVENT_INIT`.
- Validation failures abort the entire suite before any test runs — a red diagnostic from `con-validator` is the first thing to fix.
- The `memTest: true` flag prints a full heap/stack memory report after each test; use it to check for memory leaks or unexpected allocations.
- If a JSON `expect` passes but `@DebugTest` exits non-zero (or vice versa), both checks are independent — the suite fails if either fails.
- Search directories are deduplicated and checked for existence before being passed to the VM; a missing `baseCON/` is silently ignored.
