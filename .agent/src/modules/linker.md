# Linker Module Skill

The `src/modules/linker` module (`Linker.ts`) takes intermediate `.tco` objects (compiled modules) and merges them into a final executable `.con` file for EDuke32.

## Core Responsibilities

| Responsibility | Method |
|---|---|
| Load `.tco` files | `loadModule(filePath)` |
| Merge symbol tables | `mergeSymbols(modules)` |
| Allocate global `flat[]` slots | `allocateGlobals(modules)` |
| Patch placeholder tokens | `patchModule(mod, globalArrayName?)` |
| Sort modules by dependency | `sortModules()` — DFS topological sort |
| Sort defstates (forward-ref free) | `sortDefstates(code)` — Kahn's algorithm + cycle stubs |
| Separate event blocks | `separateEventBlocks(code)` |
| Generate header | `buildHeader(...)` |
| Emit unified output | `link()` → `{ code, header }` |
| Emit per-module output | `linkSeparate()` → `{ header, modules }` (used by `-sep` CLI flag) |
| Print symbol table | `printSymbolTable()` — writes `.txt` + `.json` next to output |

## Key Algorithms

### Module Topological Sort (`sortModules`)
DFS with `visited` / `visiting` sets. Circular module dependencies are logged as warnings but do not abort linking — the cycle is broken by emitting both modules and continuing.

### Defstate Topological Sort (`sortDefstates`)
Uses **Kahn's algorithm** to order `defstate` blocks so every call target is defined before its callers.

Cycle handling for mutually-recursive states:
1. Remaining states (not schedulable by Kahn) are emitted first as **stub declarations**: `defstate X\nends`
2. Their real implementations follow as `appendstate X` blocks after all Kahn-ordered states
3. This eliminates all forward references including cycles without any manual intervention

`appendstate` / `prependstate` blocks from the compiler are always emitted last, after the sorted output.

**Do not rewrite or bypass this logic** — the stub/appendstate trick is the only safe way to handle mutually recursive CON states.

### Placeholder Patching (`patchModule`)
Two marker formats are both supported:
- `_G_ADDR_SYMBOLNAME`
- `__RELOC_GLOBAL_SYMBOLNAME__`

For standalone builds: replaced with the numeric flat[] index.
For CON module builds: replaced with `globalArrayName[idx]` array access syntax.
Throws a fatal error on any unresolved global symbol.

## Symbol Table Output (`printSymbolTable`)
Writes two files alongside the output `.con`:
- `<output>.sym.txt` — human-readable: global vars, local vars by function, sub-functions, with offsets and sizes
- `<output>.sym.json` — machine-readable: same data as JSON

Changing a symbol's name in TypeScript source will change its address in these files; do not hardcode offsets from old symbol table dumps.

## Header Generation (`buildHeader`)
Generates different headers depending on mode:
- **Standalone**: framework init code + stack/heap defines + precompiled helper states
- **CON module**: EVENT_INIT validation logic (ACCEPT_CON_MODULES flag, language set compatibility check) + EVENT_NEWGAME global variable initialization block

## Agent Guidelines
- If a multi-file project reports a missing variable at runtime, check `allocateGlobals()` — the symbol may not have a `globalAllocations` entry in its `.tco` file.
- Linking does not parse TypeScript. It only works with the raw string output and JSON metadata produced by the compiler.
- If you need to change initial memory layout or register declarations, do NOT edit the linker — that belongs in `framework.ts`.
- The defstate sort is the most fragile part of the linker. When adding new CON keywords that introduce state calls, ensure `sortDefstates` regex patterns still match them.
- `linkSeparate()` is used when `--separate` / `-sep` is passed on the CLI; the per-module code chunks still share a single header.
