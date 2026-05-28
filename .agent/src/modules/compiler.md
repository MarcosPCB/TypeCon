# Compiler Module Skill

The `src/modules/compiler` directory contains the core transpiler logic for converting TypeScript AST (using `ts-morph`) into raw CON instructions or `.tco` intermediate objects.

## Core Files

| File | Purpose |
|---|---|
| `Compiler.ts` | Main driver (`TsToConCompiler` class) + `CompilerContext` interface definition |
| `Intermediate.ts` | Defines `CompiledModule` — the `.tco` JSON format (code string, relocations, global allocations, symbol table snapshot) |
| `framework.ts` | Generates the CON VM bootstrap string prepended to every output |
| `types.ts` | Compiler-side type definitions (`SymbolDefinition`, `ESymbolType`, `IVar`, etc.) |
| `services/visitX.ts` | ~30 modular visitor functions, one per TypeScript AST node type |

## Core Components

### `TsToConCompiler` (in `Compiler.ts`)
- The main driver for compilation.
- Takes a TypeScript project, initializes the AST via `ts-morph`, and traverses it via `visitStatement()`.
- Exposes two modes: `compile()` (single-pass → `.con`) and `compileModule()` (module mode → `CompiledModule`).

### `CompilerContext` (interface in `Compiler.ts`)
- The most important state-holding object in the compilation process. It is passed by reference throughout the visit sequence.
- Key fields:
  - `symbolTable: Map<string, SymbolDefinition | EnumDefinition>` — the live symbol table
  - `localVarOffset: Record<string, number>` — maps local variable names to stack offsets
  - `localVarCount: number` — tracks how many locals are allocated in the current frame
  - `globalAllocations` — list of globals needing linker-assigned `flat[]` slots
  - `paramMap: Record<string, SymbolDefinition>` — maps parameter names for the current function call
  - `currentEventName?: string` — set when entering a `CEvent`/`CInput` class (e.g. `'NEWGAME'`)
  - `curClass` / `curFunc` / `curModule` — current lexical scope identifiers
  - `currentActorPicnum` / `currentActorExtra` / `currentActorActions` etc. — state specific to a `CActor` class being compiled
  - `subFunction` — accumulates anonymous/arrow function CON `defstate` blocks
  - `initCode` — top-level CON code emitted outside any `defstate`

### `services/visitX.ts`
- Modular functions handling specific AST nodes.
- E.g., `visitClassDeclaration.ts` dispatches to `CActor`, `CEvent`, `CInput`, or plain class handling.
- E.g., `visitCallExpression.ts` converts standard function calls into `defstate` jumps or resolves native CON functions using the `nativeFunctions` registry in `TCSet100/native.ts`.
- E.g., `visitMemberExpression.ts` emits `flat[ri+offset]` indexing for object/array property access and dispatches native struct `get/set<op>[ri].<field>` instructions.

## Memory Model Emulation
- Variables are assigned offsets into the `flat[]` array.
- Local variables are pushed/popped from a simulated stack using `rsp` and `rbp` registers.
- Member accesses (`object.property`) are compiled into index offsets inside the global `flat` array.
- Native struct accesses (`sprites[i].x`) bypass `flat[]` entirely and emit direct CON `geta[ri].x` / `seta[ri].x` instructions.

## Agent Guidelines
- When modifying compilation behavior, find the corresponding `visitX.ts` file for that TypeScript construct.
- Never directly manipulate strings for memory allocation; always use `CompilerContext` methods to allocate global/local variables so they get correct `flat` array offsets.
- `CompilerContext` is an **interface**, not a class — it is spread (`{ ...context }`) to create child contexts for nested scopes (e.g. inside a class body).
