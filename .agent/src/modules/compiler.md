# Compiler Module Skill

The `src/modules/compiler` directory contains the core transpiler logic for converting TypeScript AST (using `ts-morph`) into raw CON instructions or `.tco` intermediate objects.

## Core Files

| File | Purpose |
|---|---|
| `Compiler.ts` | Main driver (`TsToConCompiler` class) + `CompilerContext` interface definition |
| `Intermediate.ts` | Defines `CompiledModule` — the `.tco` JSON format (code string, relocations, global allocations, symbol table snapshot) |
| `framework.ts` | Generates the CON VM bootstrap string prepended to every output |
| `types.ts` | Compiler-side type definitions (`SymbolDefinition`, `ESymbolType`, `IVar`, event type unions, etc.) |
| `services/visitX.ts` | ~46 modular visitor functions, one per TypeScript AST node type |
| `helper/` | Small utilities: `fnv1a32` (hash), `indent`, `formatLineDetail`, `helpers.ts` (literal eval + native lookup) |

## Core Components

### `TsToConCompiler` (in `Compiler.ts`)
- The main driver for compilation.
- Takes a TypeScript project, initializes the AST via `ts-morph`, and traverses it via `visitStatement()`.
- Exposes two modes: `compile()` (single-pass → `.con`) and `compileModule()` (module mode → `CompiledModule`).
- **File caching**: compiled files are keyed by base64-encoded path; re-imported files are skipped. `compileModule()` returns `null` if the cache short-circuits.
- **Diagnostics**: collected into `context.diagnostics[]` throughout and printed after all files are processed.

### `CompilerContext` (interface in `Compiler.ts`)
- The most important state-holding object in the compilation process. It is passed by reference throughout the visit sequence. It is an **interface**, not a class — child scopes are created via spread (`{ ...context }`).
- Key fields:

| Field | Purpose |
|---|---|
| `symbolTable` | Live symbol table for the current scope (`Map<string, SymbolDefinition \| EnumDefinition>`) |
| `globalSymbolTable` | Merged symbol table across all modules |
| `localVarOffset` | Maps local variable names to stack offsets |
| `localVarCount` | How many locals are in the current frame |
| `globalAllocations` | List of globals needing linker-assigned `flat[]` slots |
| `paramMap` | Parameter name → `SymbolDefinition` for the current call |
| `curClass` / `curFunc` / `curModule` | Current lexical scope identifiers |
| `currentActorPicnum` / `currentActorExtra` / `currentActorActions/Moves/Ais` | State specific to a `CActor` being compiled |
| `subFunction` | Sub-function accumulator: `{ code, hash, index }` — FNV-1a hash deduplicates identical arrow functions |
| `initCode` | Top-level CON code emitted outside any `defstate` (runs in `EVENT_NEWGAME`) |
| `typeAliases` | `Map<string, TypeAliasDefinition>` for type alias resolution |
| `curFpBits` / `declaredFpBits` | Fixed-point precision tracking for the current expression |
| `nativeArgFpHint` | FP precision hint passed from a call site into its arguments |
| `rfxAllocated` | Whether scratch fixed-point registers (`rfx0`–`rfx3`) have been allocated for this frame |
| `isInLoop` / `inSwitch` | Control-flow context flags |
| `diagnostics[]` | Accumulated error/warning list |

### `ECompileOptions` (enum in `framework.ts`)
Controls per-file compilation behaviour:
- `none` — normal compilation
- `no_read` — skip the file entirely (not imported at all)
- `no_compile` — build the symbol table but emit no code
- `state_decl` — treat every function as a CON `state` declaration instead of a `defstate`

### `services/visitX.ts`
- Modular functions handling specific AST nodes.
- `visitClassDeclaration.ts` dispatches to `CActor`, `CEvent`, `CInput`, or plain class handling.
- `visitCallExpression.ts` converts calls into `defstate` jumps or resolves native CON functions via `nativeFunctions` in `TCSet100/native.ts`.
- `visitMemberExpression.ts` emits `flat[ri+offset]` for object/array access or `get/set<op>[ri].<field>` for native struct access.
- `visitBinaryExpression.ts` emits `mulscale`/`divscale` automatically when both operands share the same `FP*` precision.
- `visitForStatement.ts` — C-style `for (init; cond; update)` loops. All three clauses optional; body and init locals cleaned up with `sub rsp N`. Counter lives in `flat[]`, not `rc`, so `break` safely emits `exit`.
- `visitForOfStatement.ts` — `for...of` iteration over heap arrays. Allocates 3 hidden stack slots (ptr, ctr, item); loads `flat[ptr + 1 + ctr]` each iteration; cleans up with `sub rsp 3` after the loop.
- `context.isInLoop` — set to `true` inside any loop body; controls whether `break` emits `exit` (loop exit) or `state popb; jump rb` (switch exit).

### `helper/`
- `fnv1a32.ts` — FNV-1a 32-bit hash, used to deduplicate identical sub-functions
- `indent.ts` — multi-line indentation for CON code formatting
- `formatLineDetail.ts` — wraps each line in a `//` comment for debug output
- `helpers.ts` — `evalLiteral()` / `evaluateLiteralExpression()` for constant-folding; `findNativeFunction()` and `findNativeVar_Sprite()` for native resolution

## Memory Model Emulation
- Variables are assigned offsets into the `flat[]` array.
- Local variables are pushed/popped from a simulated stack using `rsp` and `rbp` registers.
- Member accesses (`object.property`) are compiled into index offsets inside the global `flat` array.
- Native struct accesses (`sprites[i].x`) bypass `flat[]` entirely and emit direct CON `geta[ri].x` / `seta[ri].x` instructions.
- Globals use placeholder tokens (`_G_ADDR_NAME`) resolved by the Linker at link time.

## Agent Guidelines
- When modifying compilation behavior, find the corresponding `visitX.ts` file for that TypeScript construct.
- Never directly manipulate strings for memory allocation; always use `CompilerContext` to allocate global/local variables so they get correct `flat` array offsets.
- Fixed-point precision (`FP11/14/16/30`) flows through `curFpBits` / `declaredFpBits`; mismatched FP types are a compile-time error — do not add implicit casts.
- Sub-functions (anonymous/arrow functions stored as `defstate` blocks) are deduplicated by FNV-1a hash; identical bodies share one state in the output.
- `ECompileOptions.no_compile` is useful for type-declaration-only imports; `state_decl` is used by `TCSet100/precompile` sources that want their functions emitted as standalone CON states.
