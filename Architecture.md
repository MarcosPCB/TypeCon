# TypeCON Technical Architecture

This document is the complete technical reference for the TypeCON compiler, virtual machine, linker, and library ecosystem. It is written for contributors, power users, and developers extending TypeCON. Every section answers: *what exact CON is emitted and why?*

**Conventions**
- `flat[N]` — index into the CON `flat` array (the entire accessible memory space)
- `register` names in backticks refer to CON gamevars (e.g. `ra`, `rbp`)
- TypeScript code and type names in `code font`
- CON output in fenced `con` blocks
- Source file citations: `path/to/file.ts:LINE`

---

## Part I — Overview

### Section 1 — System Overview

TypeCON compiles TypeScript source files into valid EDuke32 CON scripts using [ts-morph](https://github.com/dsherret/ts-morph) for AST parsing. The full pipeline from source to loadable `.con` file:

```
  TypeScript Source Files (.ts)
           │
           ▼
  ┌──────────────────────────────────────────┐
  │  ts-morph Project (in-memory filesystem) │
  │  Project.createSourceFile()              │
  │  File → SourceFile AST                  │
  └────────────────┬─────────────────────────┘
                   │  walk top-level statements
                   ▼
  ┌──────────────────────────────────────────┐
  │       TsToConCompiler                    │
  │  (src/modules/compiler/Compiler.ts)      │
  │                                          │
  │  CompilerContext (one per file / shared) │
  │  symbolTable, localVarOffset, initCode,  │
  │  subFunction, gameVarDeclarations, …     │
  │                                          │
  │  visitStatement() dispatch               │
  │    → 46+ visitor service functions       │
  └────────────────┬─────────────────────────┘
                   │
                   ▼
              CompiledModule (.tco JSON)
              code + __PLACEHOLDER__ tokens
              + globalAllocations
              + symbolTable snapshot
              + relocation table
                   │
                   ▼
          ┌─────────────────┐
          │     Linker      │
          │  (Linker.ts)    │
          │                 │
          │ 1. topo sort    │
          │ 2. merge syms   │
          │ 3. calc globals │
          │ 4. alloc addrs  │
          │ 5. patch tokens │
          │ 6. build header │
          │ 7. merge output │
          └────────┬────────┘
                   │
                   ▼
              CONInit header
              + defstates
              + actor/event blocks
              │
              ▼
           EDUKE.CON
```

Every compilation produces a `CompiledModule` (`.tco` JSON) per file. The linker then merges all modules into the final `.con`.

**CLI entry point:** `src/main.ts` — parses flags, creates `TsToConCompiler`, calls `compileModule()` for each input file, then hands off to `Linker.link()` or `Linker.linkSeparate()`.

---

### Section 2 — File and Module Map

```
src/
├── main.ts                          CLI entry point, flag parser, orchestrator
│
├── modules/
│   ├── compiler/
│   │   ├── Compiler.ts              TsToConCompiler class; CompilerContext; ESymbolType; SymbolDefinition
│   │   ├── Intermediate.ts          CompiledModule interface; RelocationEntry
│   │   ├── framework.ts             CONInit class — generates VM bootstrap CON
│   │   ├── types.ts                 IVar, IBlock, IFunction, TObjectType, EventList, EHeapType
│   │   │
│   │   ├── helper/
│   │   │   ├── indent.ts            indent(code, n) — prefix every line
│   │   │   ├── helpers.ts           misc string utilities
│   │   │   ├── fnv1a32.ts           FNV-1a 32-bit hash (compile-time Record key hashing)
│   │   │   └── formatLineDetail.ts  -dl flag: emit original TS lines as CON comments
│   │   │
│   │   └── services/
│   │       ├── visitStatement.ts    Central dispatch: SyntaxKind → visitor
│   │       ├── visitVariableStatement.ts
│   │       ├── visitVariableDeclaration.ts  Variable allocation, FP detection, gameVar, Record
│   │       ├── visitExpressionStatement.ts
│   │       ├── visitBinaryExpression.ts     Assignment, arithmetic, string concat
│   │       ├── visitCallExpression.ts       Function calls, native dispatch
│   │       ├── visitMemberExpression.ts     Property / array access, native struct arrays
│   │       ├── visitIfStatement.ts
│   │       ├── visitWhileStatement.ts
│   │       ├── visitSwitchStatement.ts      Two-pass switch
│   │       ├── visitForStatement.ts         C-style for loop
│   │       ├── visitForOfStatement.ts       for-of over heap arrays
│   │       ├── visitReturnStatement.ts
│   │       ├── visitClassDeclaration.ts     CActor / CEvent / plain class dispatch
│   │       ├── visitConstructorDeclaration.ts
│   │       ├── visitFunctionDeclaration.ts
│   │       ├── visitArrowFunctionExpression.ts
│   │       ├── visitFunctionExpression.ts
│   │       ├── visitUnaryExpression.ts      ++/--, unary -, !
│   │       ├── visitLeafOrLiteral.ts        Identifiers, literals, FP auto-scale
│   │       ├── visitBlockOrStmt.ts          Block statement handler
│   │       ├── actorHelper.ts               TAction/TMove/TAi label + shadow-object generation
│   │       ├── subFunctionInit.ts           Anonymous function dispatcher setup
│   │       ├── getTypeBase.ts               Type-from-AST resolver
│   │       ├── getObjectLayout.ts           Object property offset assignment
│   │       ├── getObjectSize.ts             Total slot count for an object type
│   │       ├── storeTypeAlias.ts            TypeAliasDeclaration handler
│   │       ├── storeInterface.ts            InterfaceDeclaration handler
│   │       ├── storeEnum.ts                 EnumDeclaration handler
│   │       └── addDiagnostic.ts             Compiler diagnostic helper
│   │
│   ├── linker/
│   │   └── Linker.ts                Linker class — topo sort, global alloc, placeholder patch
│   │
│   ├── make/
│   │   ├── index.ts                 tcc make orchestrator
│   │   ├── config.ts                tcc make config interactive editor
│   │   ├── create.ts                tcc make create wizard
│   │   └── types.ts                 MakeConfig interface
│   │
│   ├── con-validator/               Post-link CON static analyser
│   │   └── index.ts
│   │
│   ├── con-vm/                      CON VM simulator
│   │   ├── Parser.ts                CON tokeniser → Statement[] AST
│   │   ├── Interpreter.ts           Executes statements; manages registers and structs
│   │   ├── Memory.ts                flat[] model; overflow detection; peak-water-mark
│   │   ├── Tables.ts                sintable, getangle lookup tables
│   │   └── Types.ts                 VMState, VMRunResult, StructField maps
│   │
│   └── test-runner/                 .test.json runner (compile + link + simulate + assert)
│       └── index.ts
│
└── sets/
    └── TCSet100/
        ├── native.ts                nativeFunctions array, CON_NATIVE_FLAGS, native struct vars
        ├── types.ts                 CActor, CEvent, CPlayer, FP types, enums (ESpriteFlags, …)
        ├── AnimUtils.ts             FP16 easing / interpolation library
        ├── CFile.ts                 File I/O via rstack
        ├── CJson.ts                 Recursive-descent JSON parser (runs in CON VM)
        ├── JSON.ts                  JSON.parse / JSON.stringify aliases
        ├── TCDebug.ts               Runtime stack/heap debug overlay
        ├── TCUI.ts                  Immediate-mode UI layout class
        └── precompile/
            └── src/
                ├── _recFuncs.ts     Record<string,T> runtime (FNV-1a hash map)
                ├── _mathFuncs.ts    Math helpers (pow, log, log2, log10)
                ├── _drawFuncs.ts    Multi-line text renderer
                ├── _spriteFuncs.ts  Sprite helpers (CanSeeShootInDist, ActionAndMove)
                └── _stringFuncs.ts  String ops (_convertInt2String, _convertFP2String, etc.)
```

---

## Part II — Compiler Internals

### Section 3 — CompilerContext: The Compilation State

`CompilerContext` (`Compiler.ts:157`) is the single mutable object threaded through every visitor call. One is created per file (or shared across files with `-sc`); it is mutated in-place as visitors run and serialised into `CompiledModule` at the end.

**Stack frame tracking**

| Field | Type | Role |
|---|---|---|
| `localVarOffset` | `Record<string, number>` | Maps local variable name → offset from `rbp` |
| `localVarCount` | `number` | Number of local slots allocated in the current frame |
| `localVarNativePointer` | string \| undefined | Set when a local holds a native struct pointer |
| `localVarNativePointerIndexed` | `boolean` | True for indexed native refs (`const s = sprites[2]`) |
| `paramMap` | `Record<string, SymbolDefinition>` | Parameters of the current function (mapped to `r0`–`r23`) |

**Global tracking**

| Field | Type | Role |
|---|---|---|
| `globalVarCount` | `number` | Total global slots allocated so far |
| `globalAllocations` | `Array<{name, size}>` | Globals that need linker-assigned `flat[]` indices |

**Scope cursors**

| Field | Type | Role |
|---|---|---|
| `curClass` | `SymbolDefinition` | The class currently being compiled (`undefined`-like sentinel outside a class) |
| `curFunc` | `SymbolDefinition` | The function/method currently being compiled |
| `curModule` | `SymbolDefinition` | The namespace/module currently being compiled |

**Actor-specific state**

| Field | Type | Role |
|---|---|---|
| `currentActorPicnum` | `number?` | Tile number from `super(picnum, …)` |
| `currentActorExtra` | `number?` | Strength from `super(…, strength)` |
| `currentActorIsEnemy` | `boolean?` | Whether this is an enemy actor |
| `currentActorFirstAction` | `string?` | The initial action label for the `useractor` line |
| `currentActorActions` | `string[]` | All `action` label strings accumulated so far |
| `currentActorMoves` | `string[]` | All `move` label strings |
| `currentActorAis` | `string[]` | All `ai` label strings |
| `currentActorLabels` | `Record<string, SymbolDefinition>` | Symbol entries for action/move/ai vars |
| `currentActorLabelAsObj` | `boolean` | Whether to also create shadow `flat[]` objects for labels |
| `currentActorHardcoded` | `boolean` | Skip label generation (labels provided manually) |
| `isPlayer` | `boolean?` | True when compiling a `CPlayer` subclass |
| `actorCustomChildren` | `Record<string, SymbolDefinition>?` | Non-native per-actor property symbols |
| `actorCustomInitCode` | `string?` | CON from the constructor body after `super()` |

**Event/switch/loop state**

| Field | Type | Role |
|---|---|---|
| `currentEventName` | `string?` | Event name for the current `CEvent` class |
| `inSwitch` | `boolean` | True while inside a `switch` statement |
| `isInLoop` | `boolean` | True while inside a `while`/`for`/`for-of` |
| `isInSubFunction` | `boolean` | True while inside an anonymous function body |

**Code accumulators**

| Field | Type | Role |
|---|---|---|
| `initCode` | `string` | Top-level CON emitted outside any `defstate` (global array init, etc.) |
| `subFunction` | `ISubFunction` | Accumulates anonymous-function `defstate` blocks for the current file |
| `headerDefines` | `string[]` | Extra `define` / `include` lines prepended before the output |
| `gameVarDeclarations` | `string[]` | `gamevar` lines (must appear before any `defstate` in EDuke32) |

**Type / FP tracking**

| Field | Type | Role |
|---|---|---|
| `curExpr` | `ESymbolType` | Type of the value currently sitting in `ra` |
| `curSymRet` | `SymbolDefinition` | The symbol that produced the last expression result |
| `curFpBits` | `0\|11\|14\|16\|30` | FP precision of the value in `ra`/`rd` (0 = plain integer) |
| `declaredFpBits` | `0\|11\|14\|16\|30` | Ambient FP from the surrounding variable declaration; survives expression resets |
| `nativeArgFpHint` | `0\|11\|14\|16\|30` | Expected FP for the current native call argument |
| `rfxAllocated` | `number` | How many `rfx0`–`rfx3` scratch registers are in use (0–4) |

**Other**

| Field | Type | Role |
|---|---|---|
| `symbolTable` | `Map<string, SymbolDefinition \| EnumDefinition>` | Live symbol table for the current scope |
| `typeAliases` | `Map<string, TypeAliasDefinition>` | Type alias / interface definitions |
| `diagnostics` | `CompileDiagnostic[]` | Errors and warnings accumulated during compilation |
| `options` | `CompilerOptions` | Compile flags (debug, lineDetail, stackSize, etc.) |
| `project` | `Project` | The ts-morph project instance for AST queries |

---

### Section 4 — ESymbolType Bit Flags and SymbolDefinition

#### ESymbolType

Each symbol is tagged with a bitfield of `ESymbolType` values (`Compiler.ts:66`):

| Flag | Decimal | Hex | Meaning |
|---|---|---|---|
| `error` | 0 | 0x00000 | Unresolved / invalid symbol |
| `number` | 1 | 0x00001 | Plain 32-bit integer |
| `string` | 2 | 0x00002 | Heap string pointer |
| `boolean` | 4 | 0x00004 | Boolean (stored as 0/1) |
| `object` | 8 | 0x00008 | Heap object pointer |
| `pointer` | 16 | 0x00010 | Raw pointer (native array index) |
| `function` | 32 | 0x00020 | User-defined function / defstate |
| `native` | 64 | 0x00040 | Native CON symbol (no `flat[]` slot) |
| `quote` | 128 | 0x00080 | Quote string (engine-side) |
| `class` | 256 | 0x00100 | Class definition |
| `array` | 512 | 0x00200 | Heap array pointer |
| `null` | 1024 | 0x00400 | Null literal |
| `module` | 2048 | 0x00800 | Namespace / module |
| `enum` | 4096 | 0x01000 | Enum definition |
| `constant` | 8192 | 0x02000 | Compile-time constant (no runtime slot) |
| `not_compiled` | 65536 | 0x10000 | Declaration-only (no emit) |
| `sub_function` | 131072 | 0x20000 | Arrow function / function expression stored as reference |
| `fixed_point` | 262144 | 0x40000 | Value uses fixed-point representation |
| `record` | 524288 | 0x80000 | `Record<string,T>` native hash map |

Flags compose with bitwise OR, e.g. `fixed_point | number` = `0x40001` (an FP16 scalar), `array | fixed_point` = `0x40200` (an FP array).

#### EHeapType

`EHeapType` (`Compiler.ts:58`) tags `allocTable` entries:

| Flag | Value | Meaning |
|---|---|---|
| `array` | 1 | Heap array block |
| `string` | 2 | Heap string block |
| `object` | 4 | Heap object block |
| `string_array` | 8 | Array of strings |
| `peractor` | 16 | Per-actor property block (scanned by GC via `allsprites`) |

The GC mark bit ORs in as `1024`.

#### SymbolDefinition

Key fields of `SymbolDefinition` (`Compiler.ts:103`):

| Field | Type | Role |
|---|---|---|
| `name` | `string` | Symbol name |
| `type` | `ESymbolType` | Bitfield tag |
| `offset` | `number` | Delta from the containing object's base pointer, or absolute `flat[]` index for globals |
| `size` | `number?` | Total slots this symbol occupies |
| `heap` | `boolean?` | Whether the symbol value is a heap pointer |
| `global` | `boolean?` | Whether allocated in the global segment |
| `readonly` | `boolean?` | No write-back emitted |
| `children` | `{ [key: string]: SymbolDefinition \| EnumDefinition }?` | Property map for objects; offset within parent |
| `CON_code` | `string?` | Native CON accessor string (for `ESymbolType.native`) |
| `returns` | `ESymbolType?` | Return type for functions |
| `literal` | `string \| number?` | Subfunction call address or constant value |
| `fp_bits` | `11\|14\|16\|30?` | Fixed-point precision shift for this symbol |
| `returns_fp_bits` | `11\|14\|16\|30?` | FP precision of the return value (functions) |
| `param_fp_bits` | `(11\|14\|16\|30\|0)[]?` | FP precision per parameter |
| `record_value_type` | `ESymbolType?` | Value type T in `Record<string, T>` |
| `record_value_fpbits` | `11\|14\|16\|30?` | FP precision of Record values |
| `class_name` | `string?` | Name of the instantiated class (for class-typed variables) |
| `parentFunc` | `string?` | Enclosing function name (for locals; used in `symbols.txt`) |
| `parentClass` | `string?` | Enclosing class name |

---

### Section 5 — Visitor Dispatch Architecture

#### visitStatement (the central dispatcher)

`services/visitStatement.ts` contains a single `switch (stmt.getKind())` over ts-morph `SyntaxKind` values:

| SyntaxKind | Dispatches to |
|---|---|
| `VariableStatement` | `visitVariableStatement` → `visitVariableDeclaration` |
| `ExpressionStatement` | `visitExpressionStatement` |
| `ReturnStatement` | `visitReturnStatement` |
| `IfStatement` | `visitIfStatement` |
| `SwitchStatement` | `visitSwitchStatement` |
| `TypeAliasDeclaration` | `storeTypeAlias` (no code emitted) |
| `InterfaceDeclaration` | `storeInterface` (no code emitted) |
| `EnumDeclaration` | `storeEnum` (no code emitted) |
| `BreakStatement` | emit `exit` (loop) or `state popb; jump rb` (switch) |
| `ImportDeclaration` | ignored (imports are resolved by the compiler pre-pass) |
| `FunctionDeclaration` | `visitFunctionDeclaration` |
| `WhileStatement` | `visitWhileStatement` |
| `ForStatement` | `visitForStatement` |
| `ForOfStatement` | `visitForOfStatement` |
| `ForInStatement` | diagnostic error (not supported) |
| `ExportAssignment` | ignored |

When `context.currentFile.options & ECompileOptions.no_compile` is set (declaration files), `ExpressionStatement`, `ReturnStatement`, `IfStatement`, and `SwitchStatement` are skipped — the file is scanned for declarations only.

#### Expression evaluation register flow

For a binary expression like `a * b + c` where all are `FP16`:

```
visitBinaryExpression(a * b + c):
  visitBinaryExpression(a * b):          // inner
    visitLeafOrLiteral(a) → set ra flat[rbp+a_off]   // ra = a
    set rd ra                                          // rd = a  (left operand)
    visitLeafOrLiteral(b) → set ra flat[rbp+b_off]   // ra = b  (right operand)
    mulscale rd rd ra 16                               // rd = a*b (FP16)
    set ra rd                                          // ra = result
  set rd ra                                            // save a*b in rd
  visitLeafOrLiteral(c) → set ra flat[rbp+c_off]     // ra = c
  add rd ra                                            // rd = (a*b)+c  (FP+FP → plain add)
  set ra rd                                            // ra = final result
```

`context.usingRD` is set to `true` while `rd` holds a live value. If a nested call needs `rd` for its own sub-expression, `visitForStatement` and `visitForOfStatement` emit `state pushd`/`state popd` to save and restore it.

---

## Part III — The Virtual Register Machine

### Section 6 — Registers

TypeCON implements a virtual register machine on top of CON. All registers are declared as `gamevar` with flag `132096` (`define REG_FLAGS 132096` in `framework.ts`). The `_pCptr` register uses flag `2` (per-actor).

#### General-purpose and expression registers

| Register | Init | Purpose |
|---|---|---|
| `r0`–`r23` | 0 | Function parameters. Inner loops and pre-compiled defstates also use `r4`–`r10` as scratch. |
| `ra` | 0 | **Accumulator** — result of the last expression. Every `CONUnsafe` epilogue does `set rb ra`. |
| `rb` | 0 | **Base/Return** — function return values; heap `alloc` result; `state pop` restores into `ra` then the caller copies to `rb`. |
| `rc` | 0 | **Counter** — loop iteration counter; internal uses (GC allsprites scan uses `rc`). |
| `rd` | 0 | **Data** — left-operand scratch for binary ops; pointer offset accumulator. |
| `ri` | 0 | **Index** — `flat` array index; loaded before any `flat[ri]` access. |
| `rsi` | 0 | **Source Index** — subfunction dispatcher index; native-array indexing. |

#### Control-flow registers

| Register | Init | Purpose |
|---|---|---|
| `rsw` | 0 | Switch expression value during two-pass switch execution. |
| `rswc` | 0 | Switch pass counter (`-1` = pass 1; `≥0` = pass 2 case index). |
| `rswe` | 0 | Switch case enabler — set to 1 when the matching case is found. |
| `rf` | 0 | **Flags** bitfield. Known bits: `1`=heap addr return, `2`=stack array return, `4`=stack object return, `8`=NULL return, `16`=string address, `32`=label pointer address. |

#### Stack and frame registers

| Register | Init | Purpose |
|---|---|---|
| `rbp` | 0 | **Base Pointer** — start of the current function's stack frame in `flat[]`. |
| `rsp` | `globalStaticSize - 1` | **Stack Pointer** — top of the stack; grows upward. Starts above the global segment. |
| `rbbp` | 0 | **Block Base Pointer** — set to `rbp + 1` at entry to every `actor`/`useractor`/`onevent`/`appendevent` block. Used by the actor `break` epilogue to unwind to the outermost frame. |
| `rds` | `stackSize` | **Segmentation** — marks the boundary between stack/global and heap. |

#### String stack registers

| Register | Init | Purpose |
|---|---|---|
| `rsbp` | 1024 | **String Base Pointer** — base of the current quote-string stack frame. |
| `rssp` | 1023 | **String Stack Pointer** — top of the quote stack. Quotes 1022–1023 are scratch. |

`STRINGSTACK = 1024` is the `define` that anchors the string stack. Quote indices 0–1023 are where the stack lives; indices 900–994 hold the ASCII conversion table (space=900, `!`=901, … `~`=994).

#### Expression spill registers

| Register | Init | Purpose |
|---|---|---|
| `rfx0`–`rfx3` | 0 | **Nested-expression `rd` spill file.** When a binary expression already has a live value in `rd` and needs to evaluate a sub-expression that would overwrite it, the compiler spills `rd` to the next free `rfx<N>` instead of calling `state pushd`. `context.rfxAllocated` (0–4) tracks how many are in use. If all four are occupied, the compiler falls back to `state pushd`. Pre-compiled defstates that internally clobber `rfx` registers (e.g. `_convertFP2String` uses `rfx0`/`rfx1`) must save and restore them explicitly via `flat[]`. |

#### Special registers

| Register | Init | Purpose |
|---|---|---|
| `_testCounter` | -1 | Test framework. `-1` = disabled. When `// debug-test` is active, `_testInit` sets it to 0. Encoded as `(total_count << 12) | pass_count`. |
| `_pCptr` | 0 | **Per-actor property pointer** — `GAMEVAR_PERACTOR` (flag `2`). Every sprite has its own slot. Holds the `flat[]` heap address of the actor's custom property block, or `0` if none. |

---

### Section 7 — flat[] Address Space and Memory Layout

TypeCON uses a single CON `array` named `flat` to represent the entire accessible memory space.

#### Address space layout

```
flat[] index:   0              stackSize-1   stackSize+globalSize-1
                │                  │                    │
                ▼                  ▼                    ▼
  ┌─────────────────────┬──────────────────┬──────────────────────────── …
  │   Stack             │   Globals        │   Heap (grows rightward)
  │   [0 .. sS-1]       │   [sS .. sS+gS-1]│   page0 | page1 | page2 | …
  └─────────────────────┴──────────────────┴──────────────────────────── …
        ▲       ▲                                       ▲
        │       │                                       │
       rbp    rsp (top of stack, grows right)          rds (= stackSize)
```

- `rsp` is initialised to `globalStaticSize - 1` so the first local frame starts above the global segment.
- `rds` = `stackSize` marks the heap boundary.
- The heap grows rightward via `resizearray flat` when the allocator finds no free pages.

#### Heap page management

The heap is divided into fixed-size pages of `PAGE_SIZE` words (default 4 or 8). Two parallel arrays track ownership:

```
allocTable[0]   = type flags of allocation at flat[rds + 0*PAGE_SIZE]
blockPages[0]   = total pages in this block (>0 = first page; 0 = continuation)
allocTable[1]   = 0  ← continuation of a 2-page block
blockPages[1]   = 0
allocTable[2]   = type of next separate allocation
blockPages[2]   = 1
…
```

`EHeapType` values tag `allocTable` entries. The GC mark bit (`1024`) ORs into the type field during a sweep cycle.

**Dynamic growth:** when `_GetFreePages` finds no contiguous free pages, the framework calls `resizearray flat` to extend the backing array. `heapsize` and `heaptables` track the current extents.

---

### Section 8 — Calling Convention and Stack Frames

Every user-defined function compiles to a CON `defstate`. The calling convention uses a classic frame-pointer protocol: each call saves the caller's `rbp` on the stack, installs a new `rbp` pointing to the start of the new frame, and restores everything on return.

#### Prologue and epilogue

```con
defstate MyFunction
  ; --- prologue ---
  set ra rbp         ; ra = caller's rbp
  state push         ; flat[rsp+1] = ra;  rsp++   (push saved-rbp slot)
  set rbp rsp        ; rbp = position of the saved-rbp slot
  add rbp 1          ; rbp++ → frame starts one slot above saved rbp

  ; --- body: each local: add rsp 1; setarray flat[rsp] <val> ---

  ; --- epilogue ---
  sub rbp 1          ; step back to the saved-rbp slot
  set rsp rbp        ; rsp = saved-rbp position (discard all locals)
  state pop          ; ra = flat[rsp];  rsp--   (pop saved-rbp slot)
  set rbp ra         ; restore caller's rbp
ends
```

#### Stack layout — step by step

The example below uses `globalStaticSize = 3` (globals at `flat[0..2]`, `rsp` starts at `2`).

**Step 0 — before any call (program start)**

```
 flat  │ content         │
───────┼─────────────────┼──────────────────────
  [0]  │ global_0        │
  [1]  │ global_1        │
  [2]  │ global_2        │ ← rsp  (stack not yet used)
```

**Step 1 — inside function A (2 locals: `x`, `y`)**

Prologue pushes the saved-`rbp` slot at `flat[3]`, then sets `rbp = 4`.
Each local grows `rsp` by one:

```
 flat  │ content         │ register / note
───────┼─────────────────┼──────────────────────
  [0]  │ global_0        │
  [1]  │ global_1        │
  [2]  │ global_2        │
───────┼─────────────────┼──────────────────────
  [3]  │ saved rbp_root  │ ← rbp_A - 1  (pushed by A's prologue)
  [4]  │ x               │ ← rbp_A = 4  (offset 0)
  [5]  │ y               │   rbp_A + 1  (offset 1)
       │                 │ ← rsp = 5
```

**Step 2 — A calls B (2 locals: `p`, `q`)**

B's prologue saves A's `rbp` at `flat[6]`, sets `rbp_B = 7`:

```
 flat  │ content         │ register / note
───────┼─────────────────┼──────────────────────
  [0]  │ global_0        │
  [1]  │ global_1        │
  [2]  │ global_2        │
───────┼─────────────────┼  ── frame A ──────────
  [3]  │ saved rbp_root  │   rbp_A - 1
  [4]  │ x               │ ← rbp_A = 4  (offset 0)
  [5]  │ y               │   rbp_A + 1  (offset 1)
───────┼─────────────────┼  ── frame B ──────────
  [6]  │ saved rbp_A (4) │   rbp_B - 1  (pushed by B's prologue)
  [7]  │ p               │ ← rbp_B = 7  (offset 0)
  [8]  │ q               │   rbp_B + 1  (offset 1)
       │                 │ ← rsp = 8
```

**Step 3 — B returns to A**

B's epilogue: `rsp = rbp_B - 1 = 6`; pop → `rbp = saved_rbp_A = 4`; `rsp = 5`.
Stack is back to exactly Step 1:

```
 flat  │ content         │
───────┼─────────────────┼──────────────────────
  [0]  │ global_0        │
  [1]  │ global_1        │
  [2]  │ global_2        │
───────┼─────────────────┼  ── frame A ──────────
  [3]  │ saved rbp_root  │   (still present, below rsp)
  [4]  │ x               │ ← rbp_A = 4
  [5]  │ y               │
       │                 │ ← rsp = 5   (B's slots released)
```

**Step 4 — A returns**

`rsp = rbp_A - 1 = 3`; pop → `rbp = saved_rbp_root`; `rsp = 2`. Stack is back to Step 0.

#### Saved-rbp chain

At any point in execution the chain of saved-`rbp` values threads back through every active frame:

```
rbp ──→ flat[rbp-1] = saved outer rbp
              │
              └──→ flat[saved-1] = saved outer-outer rbp
                         │
                         └──→ … until flat[N] = initial rbp (root)
```

This is how a debugger (or the `--mem` report) can reconstruct the full call chain.

#### Actor block unwind (rbbp)

At the start of every `actor`/`useractor`/`onevent`/`appendevent` block the framework records the outermost frame entry point:

```con
set rbbp rbp
add rbbp 1      ; rbbp = first local slot of the outermost actor frame
```

When `break` is emitted inside an actor (not inside a loop), the epilogue does:

```con
set rsp rbbp
sub rsp 1       ; rsp = rbbp - 1 = the saved-rbp slot of the outermost frame
state pop       ; restore root rbp
set rbp ra
```

This unwinds the entire call stack in one step, no matter how many nested function calls are active.

#### Parameter passing

Parameters are loaded into `r0`–`r23` before a `state` call:

```con
set r0 <arg0>
set r1 <arg1>
state MyFunction
; return value is in rb after return
```

Inside the function body, `r0`–`r23` are read directly (no stack spill).

---

### Section 9 — Variable Storage Details

#### Local variables

Declared with `let` or `const` inside a function body. Allocation sequence:

```con
add rsp 1
setarray flat[rsp] <initial_value>
```

The compiler records `offset = localVarOffset[name]` as the delta from `rbp`:
- Access: `set ri rbp; add ri <offset>; set ra flat[ri]`
- Write: `set ri rbp; add ri <offset>; setarray flat[ri] ra`

`localVarCount` is incremented on every allocation. At the end of a block scope the compiler emits `sub rsp N` where N is the count of slots added in that scope.

#### Global variables (module mode)

In module mode, globals use placeholder tokens in the compiled CON:

```con
set ri __G_ADDR_myGlobal__
set ra flat[ri]
```

The linker replaces `__G_ADDR_myGlobal__` with the absolute `flat[]` index assigned during `allocateGlobals()`. Globals occupy `flat[0 .. globalSize-1]`; `rsp` starts at `globalStaticSize - 1` so the stack never overlaps globals.

#### gameVar variables

`const x: gameVar = 0` emits:

```con
gamevar x 0 REG_FLAGS
```

into `context.gameVarDeclarations[]`, which is flushed to the output before any `defstate` or event block (required by EDuke32's single-pass parser). The symbol is tagged `ESymbolType.native`; reads emit `set ra x`; writes emit `set x ra` — no `flat[]` indirection.

Initial value overrides via `--vars NAME=VALUE` are applied at emit time and baked into the `gamevar` declaration literal.

#### Compile-time constants

`CON_CONSTANT<T>` declarations and `enum` members are resolved at compile time and never allocate a `flat[]` slot. They appear only as inline literals in the emitted CON.

---

### Section 10 — Type System: Fixed-Point Arithmetic

EDuke32 has no floating-point. TypeCON implements four fixed-point numeric types:

| Type | Scale | 1.0 = | Typical use |
|---|---|---|---|
| `FP11` | Q20.11 | 2048 | BUILD engine BAM angles (0–2047 = full circle) |
| `FP14` | Q17.14 | 16384 | Engine sin/cos return values (−1.0 … 1.0) |
| `FP16` | Q15.16 | 65536 | General fixed-point math, coordinates, zoom |
| `FP30` | Q1.30 | 1073741824 | High-precision unit-range values |

These are branded intersection types (`number & { __brand }`) — they are plain integers at runtime; the brand exists only for compile-time type checking.

#### Automatic code generation

The compiler reads `fp_bits` from `SymbolDefinition` and propagates `curFpBits` through every sub-expression:

| TypeScript | `curFpBits` | CON emitted |
|---|---|---|
| `let a: FP16 = b * c` (both FP16) | 16 | `mulscale rd rd ra 16` |
| `let a: FP16 = b / c` (both FP16) | 16 | `divscale rd rd ra 16` |
| `let a: FP16 = b * c` (b=FP16, c=int) | 16 | `mul rd ra` (scale preserved without mulscale) |
| `let a: number = b * c` (both int) | 0 | `mul rd ra` |

Mixing precisions (e.g. `FP16 * FP11`) is a compile-time diagnostic error.

#### Float literal auto-scaling

Float literals (e.g. `0.5`, `90.0`) are scaled to the ambient FP precision of the surrounding expression (read from `context.declaredFpBits`). When no FP context is present, they default to FP16:

```typescript
let x: FP16 = 0.5;   // → set ra 32768  (0.5 * 65536)
let y: FP11 = 0.25;  // → set ra 512    (0.25 * 2048)
```

#### Explicit cast functions

`FP16(x)`, `FP11(x)`, `FP14(x)`, `FP30(x)` are compiler-recognised call expressions:

```con
let angle: FP11 = FP11(90);   // shiftl ra 11
let v: FP16 = FP16(someInt);  // shiftl ra 16
```

A cast from one FP type to another emits the signed difference (`shiftr`/`shiftl`):
```con
let a: FP11 = FP11(fp16Var);  // shiftr ra 5   (16 - 11 = 5)
```

#### FP conversion helpers

```typescript
intToFP16(n)    // shiftl ra 16
fp16ToInt(v)    // shiftr ra 16
fp16Raw(v)      // no-op (raw integer — for APIs expecting 16.16 pattern)
fp16ToString(v) // state _convertFP2String (r0=raw, result: quote index in rb)
```

The pre-compiled `_convertFP2String` state accepts the raw FP16 integer in `r0` and produces a human-readable decimal string (e.g. `"1.5000"`) as a quote.

---

## Part IV — Control Flow

### Section 11 — if/else and while

#### if/else

`visitIfStatement` maps TypeScript conditions to CON conditionals. Comparison operators:

| TypeScript | CON |
|---|---|
| `a == b` | `ife a b` |
| `a != b` | `ifn a b` |
| `a < b` | `ifl a b` |
| `a > b` | `ifg a b` |
| `a <= b` | `ifle a b` |
| `a >= b` | `ifge a b` |

Conditions that are not simple comparisons are evaluated into `ra` first, then `ifn ra 0 { … }` wraps the body.

Locals declared inside an `if`/`else` branch are cleaned up with `sub rsp N` at the end of that branch. The compiler tracks the max N across both branches and uses the higher value as the post-if cleanup to keep the stack balanced.

#### while

```typescript
while (condition) { body }
```
emits:
```con
<condCode>       ; ra = 0 to continue, 1 to stop
whilen ra 1 {
  <body>
  <condCode>
}
```

`break` inside a `while` emits `exit` (`visitStatement.ts:64`).

---

### Section 12 — for Loop

`visitForStatement.ts` handles C-style `for (init; cond; update)` loops.

#### Emitted CON structure

```con
; init clause: allocate loop variable on stack
add rsp 1
setarray flat[rsp] <initVal>       ; e.g. i = 0

; condition check (evaluated into ra, 0 = continue)
<condCode>

whilen ra 1 {
  ; body
  <body>

  ; release body-scope locals (N = slots declared inside body)
  sub rsp <bodySlots>

  ; update clause (e.g. i++)
  <update>

  ; re-evaluate condition
  <condCode>
}

; release init-scope local (i)
sub rsp <initSlots>
```

- **Absent condition** → the condition code is omitted and the loop becomes infinite (`whilen ra 1 { … }` with `ra` always 0).
- **`break`** emits `exit`.
- **`pushd` guard**: if `context.usingRD` is already true when the for-statement is entered (meaning `rd` holds a live value from an outer expression), the visitor emits `state pushd` before the loop and `state popd` after. `localVarCount` is incremented by 1 to account for the extra stack slot.

---

### Section 13 — for-of Loop

`visitForOfStatement.ts` handles `for (const item of array)` iteration over heap arrays.

#### Hidden stack slots

Three hidden slots are pushed onto the stack at loop entry:

```
flat[rbp + ptrOffset]   = __ptr__   heap pointer to the array
flat[rbp + ctrOffset]   = __ctr__   iteration counter, initialised to 0
flat[rbp + itemOffset]  = item      current element (re-written each iteration)
```

`item` is registered in the symbol table so the loop body can read it like any local variable.

#### Emitted CON structure

```con
; push __ptr__ (array pointer from expression)
<ptrExpr>                         ; ra = heap array pointer
add rsp 1
setarray flat[rsp] ra

; push __ctr__ = 0
add rsp 1
setarray flat[rsp] 0

; push item = 0 (placeholder)
add rsp 1
setarray flat[rsp] 0

; --- loop condition: ctr < array_length ---
set ri rbp
add ri <ptrOffset>
set rd flat[ri]                   ; rd = flat[rbp+ptrOffset] = array ptr

set ri rbp
add ri <ctrOffset>
set rb flat[ri]                   ; rb = counter

set ra 1                          ; default: stop
ifl rb flat[rd] {                 ; if ctr < array_length: continue
  set ra 0
}

whilen ra 1 {
  ; --- load current element into item ---
  set ri flat[rbp+ptrOffset]
  add ri 1
  add ri flat[rbp+ctrOffset]
  set ra flat[ri]                 ; ra = array[ctr]

  set ri rbp
  add ri <itemOffset>
  setarray flat[ri] ra            ; item = array[ctr]

  ; --- body ---
  <body>

  ; --- increment counter ---
  set ri rbp
  add ri <ctrOffset>
  set ra flat[ri]
  add ra 1
  setarray flat[ri] ra

  ; --- re-check condition ---
  set rd flat[rbp+ptrOffset]
  set rb flat[rbp+ctrOffset]
  set ra 1
  ifl rb flat[rd] { set ra 0 }
}

; cleanup: release 3 hidden slots
sub rsp 3
```

The counter lives in `flat[]` (not `rc`) so `break` / `exit` leaves no stale stack slot and `rc` remains available for the GC's `allsprites` scan.

The `pushd` guard works the same as for-loops: if `context.usingRD` is true on entry, `state pushd`/`state popd` wraps the loop and `localVarCount` is incremented by 1.

---

### Section 14 — Switch Statement (Two-Pass)

CON has no native `switch`; TypeCON implements one using `getcurraddress` and a two-pass execution trick.

#### Emitted CON structure (3-case example)

```con
; --- Pass 1: capture address and evaluate ---
getcurraddress ra                  ; ra = address of this instruction
set rsw <switchExpr>               ; rsw = switch value
set rswc -1                        ; mark as pass 1

; --- Pass 2 entry check ---
ifn rswc -1 {
  ; we are in pass 2 — run the cases
  ife rswc 0 { set rswe 0 }        ; reset enabler at start of pass 2

  ; case 0
  ife rsw <val0> { set rswe 1 }
  ifn rswe 0 {
    <case0_body>
    state popb                     ; pop saved address
    jump rb                        ; jump past switch (break)
  }

  ; case 1
  ife rsw <val1> { set rswe 1 }
  ifn rswe 0 {
    <case1_body>
    ; (no break → fallthrough to case 2)
  }

  ; default
  ; (always enabled after last case)
  <default_body>
  state popb
  jump rb
}

; --- Pass 1 epilogue: jump back to getcurraddress ---
ife rswc -1 {
  set rswc 0
  state pushb                      ; save return address
  jump ra                          ; jump back to getcurraddress → enter pass 2
}
```

#### Two-pass execution sequence

```
Pass 1:
  getcurraddress ra        ← address recorded
  rswc = -1
  ifn rswc -1 → FALSE      ← skip the case body
  ife rswc -1 → TRUE        ← take the jump path
  state pushb (save ra)
  jump ra                  ← re-enter at getcurraddress

Pass 2:
  getcurraddress ra        ← same address (ignored this time)
  ifn rswc -1 → TRUE        ← enter the case block
  evaluate cases, set rswe
  execute enabled clauses
  break → state popb; jump rb  ← exit switch
```

`rswc` starts at `0` on pass 2 entry. `rswe` enables case bodies when `ife rsw <val>` matches.

---

### Section 15 — Subfunctions (Anonymous Functions)

Arrow functions and function expressions referenced as values (stored in a variable or passed as arguments) are compiled into a shared per-file dispatcher `defstate` (`subFunctionInit.ts`).

#### Naming and index encoding

The dispatcher is named `_subFunctions_<hash>` where `<hash>` is a 6-byte shake256 digest of the source file path. Each anonymous function gets an index starting at 1; its **case value** is `index * 100 + 0x10000` (e.g. index 1 → `65636`, index 2 → `65736`). This encoding keeps case values well outside any realistic `rsi` range, preventing accidental collisions with non-subfunction calls. The encoded value is stored in `SymbolDefinition.literal` so every call site can emit it as a compile-time constant.

#### Dispatcher structure

The dispatcher uses:
- A **native CON `switch rsi`** to dispatch to the correct function body — `rsi` holds the encoded case value set by the caller.
- A **`getcurraddress` re-entry jump** to handle the two-phase dispatch: capture the return address on the first pass, then re-enter at the top to run the switch.

```con
defstate _subFunctions_A1B2C3
    state pushd                   ; save rd (outer expression may have a live value there)
    set rd 0
    getcurraddress rb             ; rb = addr_TOP (address of this instruction)  ← addr_TOP

    ife rd 1 {                    ; second pass: rd=1 → run the switch
        switch rsi                ; native CON switch — dispatches by case value
            case 65636:           ; index 1  (1 * 100 + 0x10000)
                <arrowFunction0_body>
                state pop         ; ra = saved return address (addr_RET, see below)
                set rd 0          ; reset rd so the else branch is skipped on re-entry
                jump ra           ; jump to addr_RET → fall through to state popd; ends
                break

            case 65736:           ; index 2  (2 * 100 + 0x10000)
                <arrowFunction1_body>
                state pop
                set rd 0
                jump ra
                break

        endswitch
    } else {                      ; first pass: rd=0 → capture return address, then jump back
        set rd 1
        getcurraddress ra         ; ra = addr_RET (address of this instruction)  ← addr_RET
        ife rd 1
        {
            state push            ; push addr_RET onto stack (return address for the body)
            jump rb               ; jump to addr_TOP → re-enter with rd=1
        }
    }
    state popd                    ; restore outer rd
ends
```

#### Execution flow

```
Caller:
  set rsi 65636          ; select function index 1
  state _subFunctions_A1B2C3

Inside dispatcher — first entry (rd = 0):
  state pushd            ; save outer rd
  set rd 0
  getcurraddress rb      ; rb = addr_TOP
  ife rd 1 → FALSE       ; skip the switch block
  else:
    set rd 1
    getcurraddress ra    ; ra = addr_RET
    ife rd 1 → TRUE
      state push         ; push addr_RET (return address)
      jump rb            ; ── jump to addr_TOP ──▶

Inside dispatcher — second entry (rd = 1):
  getcurraddress rb      ; rb = addr_TOP (again)
  ife rd 1 → TRUE        ; enter the switch block
    switch rsi           ; rsi = 65636 → case 65636
      <arrowFunction0_body executes>
      state pop          ; ra = addr_RET (popped from stack)
      set rd 0           ; clear rd
      jump ra            ; ── jump to addr_RET ──▶

At addr_RET (inside else, after getcurraddress ra):
  ife rd 1 → FALSE (rd=0) ; skip push/jump
  exit else block
  state popd             ; restore outer rd
  ends                   ; return to original caller
```

#### Call site emission

A caller sets `rsi` to the encoded index and calls the dispatcher:

```con
set rsi 65636
state _subFunctions_A1B2C3
; return value (if any) is in rb
```

The encoded index is stored in `SymbolDefinition.literal` when the anonymous function is first compiled, so every subsequent call site reads it as a compile-time constant — no runtime index lookup needed.

---

## Part V — Objects, Arrays, Heap

### Section 16 — Heap Objects and Arrays

#### Allocation protocol

```con
set r0 <size_in_words>
state alloc          ; returns: rb = flat[] address of allocated block
```

`state alloc` searches `allocTable` for `<size>` contiguous free pages, marks them in `allocTable` with the heap type, sets `blockPages[first]` = number of pages, and returns the base address in `rb`.

`rf` bit 0 (`= 1`) can be set before a call to signal that the return value should be treated as a heap address (used by some native wrappers).

#### Array heap layout

```
flat[ptr]     = length N
flat[ptr+1]   = element[0]
flat[ptr+2]   = element[1]
…
flat[ptr+N]   = element[N-1]
```

Initial allocation: `1 + N` words.

#### Object heap layout

Property offsets are determined at compile time by `getObjectLayout.ts` and stored in `SymbolDefinition.children`:

```
flat[ptr + 0]  = prop0   (offset 0 in SymbolDefinition)
flat[ptr + 1]  = prop1   (offset 1)
flat[ptr + 2]  = prop2   (offset 2)
…
```

#### Side-by-side comparison

```
Array at flat[ptr]:                 Object {x, y, z} at flat[ptr]:
┌───────────────────┐               ┌───────────────────┐
│ flat[ptr]   = N   │  length       │ flat[ptr+0] = x   │  offset 0
│ flat[ptr+1] = e0  │  element 0    │ flat[ptr+1] = y   │  offset 1
│ flat[ptr+2] = e1  │  element 1    │ flat[ptr+2] = z   │  offset 2
│ flat[ptr+3] = e2  │  element 2    └───────────────────┘
└───────────────────┘
```

#### Inline object assignment

`this.state = { phase: 0, timer: 0 }` is expanded by `visitBinaryExpression` into individual slot writes:

```con
set ri _pCptr
add ri <stateOffset>      ; flat[_pCptr + stateOffset] = phase
setarray flat[ri] 0
add ri 1                   ; flat[_pCptr + stateOffset + 1] = timer
setarray flat[ri] 0
```

---

### Section 17 — String Management

TypeCON uses two parallel string systems.

#### Flat strings (heap-allocated)

All TypeCON strings in logic code are heap-allocated character arrays:

```
flat[ptr]     = length N
flat[ptr+1]   = ASCII code of char[0]
flat[ptr+2]   = ASCII code of char[1]
…
flat[ptr+N]   = ASCII code of char[N-1]
```

Tagged `EHeapType.string = 2` in `allocTable`. Operations like `_stringConcat` and `_convertInt2String` work directly on these buffers.

#### Quote strings (engine display)

The Build Engine displays text via global "quotes" (indices 0–1023). TypeCON manages quote indices 1024–(1024+stackSize) as a stack for local scoping. Quote indices 1022–1023 are permanent scratch.

The ASCII conversion table occupies quotes 900–994:
- `string 900 ` (space, ASCII 32)
- `string 901 !`
- `string 902 "` (ASCII 34)
- … up to `string 994 ~` (ASCII 126)

#### String pipeline: flat → quote

```
TypeScript string literal "hello"
         │
         ▼  (at init time, via _initString state)
flat[ptr]   = 5           (length)
flat[ptr+1] = 104         ('h')
flat[ptr+2] = 101         ('e')
flat[ptr+3] = 108         ('l')
flat[ptr+4] = 108         ('l')
flat[ptr+5] = 111         ('o')
         │
         │  (when displayed: state _convertString2Quote)
         │  r0 = flat string ptr
         ▼
for each char c in flat string:
  copy ASCII_TABLE_QUOTE[c-32] → qstrncat quotes[rssp+1]
rssp++
quotes[rssp] now = "hello"
```

`rssp` increments after each push. `rsbp` marks the frame base; all pushes above `rsbp` are local to the current call.

---

### Section 18 — Garbage Collector

TypeCON implements a non-intrusive two-pass Mark-and-Sweep GC via the `_GC` defstate.

#### Algorithm

1. **Scan**: iterate `allocTable[0..heaptables-1]` for active pages (type ≠ 0 and not marked 1024).

2. **Mark (stack)**: scan `flat[0..rsp]` — if any value matches a heap page address, mark that page as "live" (clear bit 1024 if set).

3. **Mark (per-actor)**: for allocations of type `EHeapType.peractor (16)`, additionally scan via:
   ```con
   for rc allsprites {
     getactorvar[rc]._pCptr ra
     ; if ra matches a heap address → mark as live
   }
   ```
   This keeps per-actor property blocks alive even when not on the stack.

4. **Sweep**:
   - If a page was found on the stack or in `_pCptr`: it is live — clear any pending `1024` mark.
   - If a page was NOT found AND already has bit `1024` set: physically free it (`allocTable = 0`).
   - If a page was NOT found AND does NOT have bit `1024`: set bit `1024` (deferred free — will be collected next cycle).

5. **Lifecycle hook**: `appendevent EVENT_KILLIT` in the framework checks `_pCptr` for every dying actor:
   ```con
   set ra _pCptr
   ifn ra 0 {
     set r0 ra
     state free
     set _pCptr 0
   }
   ```

The `--2-pass-gc` simulator flag runs `_GC` twice, converting "marked to free" → "reclaimed" so the memory report shows accurate post-GC heap usage.

---

### Section 19 — Record\<string, T\> Native Hash Map

`Record<string, T>` is a compiler-native hash map backed by the `_recFuncs` pre-compiled module.

#### Heap block layout

```
flat[ptr + 0]               = capacity  (power-of-2, default 16)
flat[ptr + 1]               = count     (live entries)
flat[ptr + 2 + i*2 + 0]     = hash      (0 = empty, -1 = tombstone)
flat[ptr + 2 + i*2 + 1]     = value
```

Collisions are resolved by linear probing with wrap-around. The table auto-doubles (`_rec_resize`) when `count > capacity * 3 / 4`.

#### Runtime defstates (calling conventions)

| Defstate | Input | Output | Description |
|---|---|---|---|
| `_rec_alloc` | `r0`=capacity (0→16) | `rb`=ptr | Allocates a `2 + capacity*2` word block |
| `_rec_hash` | `r0`=key_str_ptr | `rb`=hash (1-based FNV-1a) | Hashes a heap string; 0 remapped to 1 |
| `_rec_get` | `r0`=hash, `r1`=rec_ptr | `rb`=val, `rc`=found (0/1) | Linear-probe lookup |
| `_rec_set` | `r0`=hash, `r1`=rec_ptr, `r2`=val | — | Insert or update; triggers resize at 75% load |
| `_rec_del` | `r0`=hash, `r1`=rec_ptr | — | Tombstone slot; decrement count |
| `_rec_free` | `r0`=rec_ptr | — | Free the hash table block |

#### Compile-time behaviour

When the compiler sees `Record<string, T>` in a type annotation it:
1. Tags the symbol with `ESymbolType.record` and records `record_value_type`/`record_value_fpbits`.
2. Emits `state _rec_alloc` for the empty-literal initializer (`{}`).
3. **String-literal key** (`r["score"]`): computes FNV-1a at compile time via `helper/fnv1a32.ts` and emits the integer hash constant directly — zero runtime hashing cost.
4. **Runtime key** (variable): emits `state _rec_hash` before lookup/store.
5. **Write** (`r["k"] = v`): emits `state _rec_set` with `r0`=hash, `r1`=record_ptr, `r2`=value.
6. **Read** (`v = r["k"]`): emits `state _rec_get` with `r0`=hash, `r1`=record_ptr; result in `rb`.

---

### Section 20 — CJson — Recursive-Descent JSON Parser

`CJson` (`src/sets/TCSet100/CJson.ts`) is a full JSON parser written in TypeScript/TypeCON that runs entirely in the CON VM.

#### 5-word instance layout

```
flat[ptr + 0]  _src     → pointer to the source heap string being parsed
flat[ptr + 1]  _pos     → current parse cursor (character index into _src)
flat[ptr + 2]  _type    → CJsonType tag (0–6, see below)
flat[ptr + 3]  _val     → raw value: int, FP16 raw, heap-string ptr, or block ptr
flat[ptr + 4]  _owned   → 1 = this node owns its data (must Free()); 0 = view
```

#### CJsonType enum

| Value | Name | `_val` meaning |
|---|---|---|
| 0 | `Null` | 0 |
| 1 | `Bool` | 0 or 1 |
| 2 | `Int` | raw 32-bit integer |
| 3 | `FP16` | fixed-point value (65536 = 1.0) |
| 4 | `String` | pointer to heap string |
| 5 | `Array` | pointer to array block |
| 6 | `Object` | pointer to object block |

#### Array block layout

```
flat[arr + 0]              = element count N
flat[arr + 1 + i*2 + 0]   = type  of element i  (CJsonType)
flat[arr + 1 + i*2 + 1]   = value of element i
```
Initial allocation: `1 + 16*2 = 33` words; grows as needed.

#### Object block layout

```
flat[obj + 0]              = key count N
flat[obj + 1 + i*3 + 0]   = key string pointer
flat[obj + 1 + i*3 + 1]   = value type  (CJsonType)
flat[obj + 1 + i*3 + 2]   = value
```
Initial allocation: `1 + 16*3 = 49` words.

#### Parser flow

`new CJson(text)` calls `_parseValue()` which dispatches on the first non-whitespace character:

| First char | Action |
|---|---|
| `{` | `_parseObject()` — allocates object block, loops over `"key": value` pairs |
| `[` | `_parseArray()` — allocates array block, loops over values |
| `"` | `_parseString()` — copies the slice into a fresh heap string |
| `t` / `f` | sets `_type=Bool`, advances `_pos` by 4 or 5 |
| `n` | sets `_type=Null`, advances 4 |
| `-` or `0-9` | `_parseNumber()` — integer or FP16 for decimals (via `_stringToFP16`) |

**Key invariant:** `_type` and `_val` on `this` are overwritten by recursive child parses. `_parseArray` and `_parseObject` save their `arrPtr`/`objPtr` to a local before recursing, then restore `_type`/`_val` afterwards.

`Find()` uses FNV-1a on the query string, scans object block entries, and returns a 5-word view node (`_owned=0`). `ri` is clobbered by the inner per-entry hash loop, so `r10` holds a stable copy of `obj_ptr` for the outer loop.

**`ToRecord()` stack-balance requirement:** the TypeCON compiler emits a single `sub rsp N` after an if-else to release all locals declared in either branch. If the two branches allocate different numbers of locals the cleanup count is wrong. `ToRecord()` calls `Find(k)` before the `if (GetTypeAt(i) == Object)` branch so both branches see the same `child` local on the stack.

#### Navigation API

| Method | Returns | Notes |
|---|---|---|
| `GetType()` | `CJsonType` | Tag of this node |
| `IsNull()` | `bool` | `_type == 0` |
| `GetBool()` | `bool` | `_val != 0`; uses `CONUnsafe` to bypass TS bool restriction |
| `GetInt()` | `number` | `_val`; auto-converts FP16 → int |
| `GetNumber()` | `FP16` | `_val`; auto-converts int → FP16 |
| `GetString()` | `string` | Heap string pointer cast |
| `GetLength()` | `number` | Element count from array/object block header |
| `GetItem(i)` | `CJson` | View node for array element `i`; do **not** `Free()` it |
| `Find(key)` | `CJson` | FNV-1a key lookup; returns Null node if missing; do not `Free()` |
| `GetKey(i)` | `string` | Key string at object index `i` |
| `Stringify()` | `string` | Recursive serialisation back to compact JSON |
| `ToRecord()` | `Record<string, any>` | Converts Object node to native `Record`; recursively nests |
| `Free()` | — | Recursively frees all owned heap blocks |

---

## Part VI — Actor and Event System

### Section 21 — CActor and CPlayer Class Compilation

`visitClassDeclaration.ts` detects `extends CActor` (or `CPlayer`) and switches into actor compilation mode.

#### Compilation steps

1. **Property scan**: all property declarations are collected. Non-native properties (not declared in the native type system) are gathered into `actorCustomChildren` and assigned sequential offsets in the `_pCptr` block.

2. **Label extraction**: `actorHelper.ts` is called for `TAction<…>`, `TMove<…>`, `TAi<…>` properties. It generates both native CON labels and (when `currentActorLabelAsObj = true`) shadow `flat[]` objects.

3. **Constructor parse**: `visitConstructorDeclaration` extracts `super(picnum, isEnemy, strength)` arguments into `currentActorPicnum`, `currentActorIsEnemy`, `currentActorExtra`; remaining statements are compiled into `actorCustomInitCode`.

4. **Main() method**: compiled into a `defstate <ClassName>_Main` block.

#### Generated CON structure for a CActor subclass

```con
; --- native labels ---
action A_MYACTOR_WALK 0 4 1 1 8
action A_MYACTOR_STAND 0 1 5 1 1
move  M_MYACTOR_RUN  200 0
move  M_MYACTOR_STOP 0   0
ai    AI_SEEK A_MYACTOR_WALK M_MYACTOR_RUN seekplayer

; --- actor main loop ---
useractor ENEMY <picnum> <strength> <firstAction>

defstate MyActor_Main
  ; prologue
  set ra rbp
  state push
  set rbp rsp
  add rbp 1

  ; body of Main()
  <main_body_code>

  ; epilogue
  sub rbp 1
  set rsp rbp
  state pop
  set rbp ra
ends

; --- EVENT_SPAWN: allocate _pCptr, set defaults, run constructor body ---
appendevent EVENT_SPAWN
  ifactor <picnum> {
    set r0 <propBlockSize>
    state alloc
    set _pCptr rb

    ; write default property values
    set ri rb
    setarray flat[ri] 0          ; prop0 default
    add ri 1
    setarray flat[ri] 0          ; prop1 default
    …

    ; constructor body (after super())
    <actorCustomInitCode>
  }
endevent

; --- EVENT_KILLIT: free _pCptr ---
appendevent EVENT_KILLIT
  ifactor <picnum> {
    set ra _pCptr
    ifn ra 0 {
      set r0 ra
      state free
      set _pCptr 0
    }
  }
endevent
```

---

### Section 22 — Per-Actor Custom Properties (_pCptr)

`_pCptr` is a `GAMEVAR_PERACTOR` (flag `2`) holding the `flat[]` heap address of an actor's custom property block, or `0` if none.

#### Supported property types and storage

| TypeScript type | Storage | Block slots |
|---|---|---|
| `number` / `boolean` | Scalar value inline | 1 |
| Known interface/type | Inline object (contiguous fields) | N (one per field) |
| `number[]` / `string[]` | Heap pointer (array allocated separately in constructor) | 1 |
| `string` | Heap pointer | 1 |

#### Block layout example

```typescript
class Enemy extends CActor {
  public phase: number = 0;
  public pos:   { x: number; y: number } = { x: 0, y: 0 };
  public hp:    number = 100;
}
```

```
flat[_pCptr + 0]  = phase        (scalar, offset 0)
flat[_pCptr + 1]  = pos.x        (inline object field, offset 1)
flat[_pCptr + 2]  = pos.y        (inline object field, offset 2)
flat[_pCptr + 3]  = hp           (scalar, offset 3)
```

#### Property access (generated by visitMemberExpression)

```con
; this.hp -= 1
set ri _pCptr
add ri 3                  ; offset of hp
set ra flat[ri]
sub ra 1
setarray flat[ri] ra

; this.pos.x += 10
set ri _pCptr
add ri 1                  ; offset of pos.x = pos_offset(1) + x_offset(0)
set ra flat[ri]
add ra 10
setarray flat[ri] ra
```

#### GC interaction

The GC's `allsprites` scan (`for rc allsprites { getactorvar[rc]._pCptr ra }`) keeps per-actor blocks live as long as the actor sprite exists. `EVENT_KILLIT` frees the block; `_pCptr` is then reset to `0`.

---

### Section 23 — CEvent and CInput Classes

`extends CEvent` with a constructor `super('EventName')` generates:

```con
appendevent EVENT_EVENTNAME
  <Append()_body>
endevent
```

Additional methods (beyond `Append()`) compile into separate named `defstate` blocks.

`extends CInput` is treated as an alias for `extends CEvent` with `currentEventName = 'PROCESSINPUT'`.

The `EventList` array in `src/modules/compiler/types.ts` defines all 50+ valid event names, grouped into five categories:
- **PAE** — per-actor events (SPAWN, KILLIT, DAMAGE, …)
- **DE** — display events (DISPLAYEND, DISPLAYSTART, …)
- **IE** — input events (PROCESSINPUT, DISPLAYROOMS, …)
- **WE** — weapon events (FIREWEAPON, CHANGEWEAPON, …)
- **PIE** — player-instance events (ENTERLEVEL, …)
- **ME** — map events (ANIMATESPRITES, …)

---

### Section 24 — gameVar Type

`const x: gameVar = 0` is detected by `visitVariableDeclaration.ts` via the type alias name `'gameVar'`.

**Compiler behaviour:**
1. Emits `gamevar x 0 REG_FLAGS` into `context.gameVarDeclarations[]`.
2. `gameVarDeclarations[]` is flushed to the output before any `defstate` or event block — required by EDuke32's single-pass parser.
3. Registers the symbol as `ESymbolType.native` with `CON_code: 'x'`.
4. Reads emit `set ra x`; writes emit `set x ra` — no `flat[]` indirection.
5. `--vars NAME=VALUE` overrides are applied at emit time (substituted into the literal declaration).

---

### Section 25 — Actions, Moves, and AI Labels

Actions, moves, and AI configs are declared as typed object literals on CActor properties:

```typescript
protected readonly actions: TAction<'aWalk' | 'aShoot'> = {
  aWalk:  { start: 0, length: 4, viewType: 5, incValue: 1, delay: 12 },
  aShoot: { start: 35, length: 1, viewType: 5, incValue: 1, delay: 30 },
};
```

`actorHelper.ts` processes these via `parseVarForActionsMovesAi()`, generating:

**1. Native CON labels** (always emitted):
```con
action A_CLASSNAME_AWALK  0 4 5 1 12
action A_CLASSNAME_ASHOOT 35 1 5 1 30
```

**2. Shadow flat[] objects** (when `currentActorLabelAsObj = true`):
```
IAction layout at flat[ptr]:
  flat[ptr+0] = loc        (label pointer — internal address)
  flat[ptr+1] = start
  flat[ptr+2] = length
  flat[ptr+3] = viewType
  flat[ptr+4] = incValue
  flat[ptr+5] = delay

IMove layout at flat[ptr]:
  flat[ptr+0] = loc
  flat[ptr+1] = horizontal_vel
  flat[ptr+2] = vertical_vel

IAi layout at flat[ptr]:
  flat[ptr+0] = loc
  flat[ptr+1] = action (pointer to IAction)
  flat[ptr+2] = move   (pointer to IMove)
  flat[ptr+3] = flags
```

The dual representation allows passing an `IAction` as a variable in TypeScript (resolved to the shadow `flat[]` address) while still emitting the native `action` label when the actor block requires it.

---

## Part VII — Module System and Linker

### Section 26 — Module Mode and CompiledModule (.tco)

**What triggers module mode:** the `-m` flag, any entry in `typecon.json:modules[]`, or `-c` (compile-only) flag.

**CompiledModule interface** (`Intermediate.ts`):

```typescript
interface CompiledModule {
  name: string;              // module identifier (usually filename without .ts)
  version: string;           // TypeCON version string
  context: Record<string, SymbolDefinition | EnumDefinition>;  // symbol table snapshot
  globalAllocations: Array<{ name: string; size: number }>;    // globals needing flat[] slots
  code: string;              // CON code with __PLACEHOLDER__ tokens
  dependencies: string[];    // module names this module depends on
  markerDefines: Record<string, string>;  // extra define/include markers
}
```

**RelocationEntry** (`Intermediate.ts`):

```typescript
interface RelocationEntry {
  offset: number;            // character offset in code string
  length: number;            // token length
  symbolName: string;        // e.g. 'myGlobal'
  type: 'global_offset' | 'function_label' | 'class_offset';
}
```

**Placeholder token format:** `__G_ADDR_<name>__` for global variable addresses; `__F_<label>__` for function labels; `__C_<offset>__` for class property offsets.

---

### Section 27 — Linker Pipeline

The `Linker` class (`src/modules/linker/Linker.ts`) executes seven ordered steps:

```
.tco modules loaded via loadModule()
           │
           ▼
┌─────────────────────┐
│  1. Topological     │  DFS on dependencies[]; detect cycles
│     sort            │  → sortedModules[]
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  2. Merge symbols   │  for each module in topo order:
│                     │  insert into globalSymbolTable;
│                     │  error on duplicate non-function symbols
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  3. Calculate       │  sum globalAllocations[].size across all modules
│     global size     │  → globalSize
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  4. Re-init         │  new CONInit(stackSize, …, globalSize)
│     CONInit         │  so rsp starts at the correct globalStaticSize-1
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  5. Allocate        │  globalOffset = 0
│     globals         │  for each globalAllocation:
│                     │    memoryMap[name] = globalOffset
│                     │    globalOffset += size
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  6. Patch           │  for each module's code:
│     placeholders    │  replace __G_ADDR_name__ → memoryMap[name]
│                     │  replace __F_label__     → resolved state address
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  7. Build           │  finalInit.BuildFullCodeFile()
│     & merge output  │  + defstates in topo order
│                     │  + actor/event blocks after all defstates
└──────────┬──────────┘
           ▼
        EDUKE.CON
```

`linkSeparate()` outputs each module as a separate `.con` file (for CON module mode). `link()` merges everything into one file.

Symbol dump (`-sp` flag): calls `printSymbolTable()` which writes `symbols.txt` and `symbols.json` to the output folder with global variables (address, size, type), local variables per function (offset, size, type), and sub-functions.

---

### Section 28 — CONInit VM Bootstrap (framework.ts)

`CONInit.BuildFullCodeFile()` combines the following components in order:

1. **Marker defines** — `define ACCEPT_CON_MODULES 1` if the flag is set.

2. **`define REG_FLAGS 132096`** — the gamevar flag used for all registers.

3. **Register declarations** — all 32 registers as `var NAME 0 REG_FLAGS` (in order: r0–r23, ra, rb, rc, rd, ri, rsi, rsw, rswc, rswe, rf, rds, rbp, rsp, rbbp, rsbp, rssp, rfx0–rfx3, _testCounter, _pCptr).

4. **`define STRINGSTACK 1024`**

5. **ASCII conversion table** — `string 900 ` through `string 994 ~` (95 entries, space through tilde).

6. **Quote string stack reservations** — `string N reserved` for N = 1023 to 1023 + stackSize.

7. **Heap metadata gamevars** — `playerDist` (peractor), `heapsize`, `heaptables`.

8. **`define PAGE_SIZE N`** — heap page size.

9. **Array declarations** — `allocTable`, `blockPages`, `rstack` (24 slots), `flat` (initial size = stackSize).

10. **`initStates`** — all helper defstates, including:
    - `push` / `pop` — single-slot stack push/pop
    - `pushr1`–`pushr12` / `popr1`–`popr12` — bulk register save/restore
    - `pushd` / `popd` — `rd` save/restore (used by for/for-of guards)
    - `pushb` / `popb` — `rb` save/restore (used by switch)
    - `_GetFreePages` — find contiguous free pages in allocTable
    - `alloc` — allocate N pages; tag allocTable; return address in `rb`
    - `free` — mark pages free in allocTable
    - `realloc` — resize an existing allocation
    - `_GC` — mark-and-sweep garbage collector
    - `_convertInt2String` — integer → heap string
    - `_convertFP2String` — FP16 → heap string (`r0`=raw, `rb`=quote index)
    - `_convertString2Quote` — flat string → engine quote (`r0`=ptr, `rb`=quote index)
    - `_krand` — seeded random number (CON `krand` wrapper)
    - `_IsRandom` — probability check
    - `_stringConcat` — concatenate two heap strings
    - `_testInit` — set `_testCounter` to 0 (enter test mode)

11. **`GetPrecompiledCode()`** — reads `.con` files from `asm/generated/`, deduplicates by defstate name, concatenates. Pre-compiled defstates that clobber `rfx0`–`rfx3` save and restore them via `flat[]` so they do not corrupt live spill values placed there by the calling compiler-generated code.

12. **`BuildFullCodeFile()`** — prepends `initCode` (user-level global init code) then appends all of the above.

---

## Part VIII — Native Integration

### Section 29 — Language Sets and Native Functions

**Language sets** (`src/sets/TCSet100/`) define the entire native environment available to TypeScript code. `native.ts` is the core mapping file.

#### nativeFunctions array

Each entry is a `CON_NATIVE_FUNCTION` object:

```typescript
interface CON_NATIVE_FUNCTION {
  name: string;                         // TypeScript method name
  code: string | ((args, context) => string);  // CON template or generator
  fp_aware_code?: (...) => string;      // FP-aware variant
  inherit_fp_bits?: boolean;            // propagate FP precision from first arg
  returns?: ESymbolType;
  return_type?: string;
  returns_fp_bits?: 11 | 14 | 16 | 30;
  arg_fp_bits?: (11 | 14 | 16 | 30 | 0)[];
  arguments?: CON_NATIVE_FLAGS[];       // how to resolve each argument
  arguments_default?: (string|number)[]; // default values
  object_belong?: string;               // which class this method belongs to
  type_belong?: string;                 // type constraint for the receiver
}
```

`CON_NATIVE_FLAGS` controls argument resolution:

| Flag | Value | Meaning |
|---|---|---|
| `CONSTANT` | 1 | Pass as compile-time literal |
| `VARIABLE` | 2 | Pass as CON gamevar name |
| `STRING` | 4 | Evaluate as string expression |
| `LABEL` | 8 | Resolve as a CON label (action/move/ai) |
| `OPTIONAL` | 16 | Argument may be omitted |
| `FUNCTION` | 32 | Argument is a function reference |
| `ACTOR` | 64 | Argument is an actor tile number |
| `PROJECTILE` | 128 | Argument is a projectile type |
| `OBJECT` | 256 | Argument is an object property access |
| `ARRAY` | 512 | Argument is an array expression |
| `HEAP_POINTER` | 1024 | Argument is a raw heap address |

#### The ten native struct arrays

TypeCON exposes ten EDuke32 struct arrays as global read/write objects:

| TS global | CON op | Interface | Description |
|---|---|---|---|
| `sprites[]` | `a` | `CActor` | All sprites/actors in the map |
| `sectors[]` | `sector` | `CSector` | All sectors |
| `walls[]` | `wall` | `CWall` | All walls |
| `players[]` | `p` | `CPlayer` | All player slots |
| `projectiles[]` | `projectile` | `IProjectile` | Per-tile projectile definitions |
| `tsprites[]` | `tspr` | `ITSprite` | Renderer draw list (current frame) |
| `userdef[]` | `userdef` | `IUserDef` | Global game settings |
| `input[]` | `input` | `IInput` | Per-player raw input |
| `tiledata[]` | `tiledata` | `ITileData` | Per-tile art metadata (read-only) |
| `paldata[]` | `paldata` | `IPalData` | Per-palette flags (read-only) |

Member access: `sprites[i].extra` → `geta[ri].extra ra`
Assignment: `sprites[i].extra = 0` → `seta[ri].extra ra`

All ten names are excluded from symbol-table lookup in `visitMemberExpression.ts` so they bypass the local-variable path and fall directly into the CON accessor code generation.

---

### Section 30 — Native Struct Sub-Object Access

Many structs expose logical sub-objects that alias the same CON field:

```
projectiles[i].audio.fire   → getprojectile[ri].isound ra
projectiles[i].iSound       → getprojectile[ri].isound ra   (same)

input[i].motion.forward     → getinput[ri].fvel ra
input[i].forwardVel         → getinput[ri].fvel ra           (same)

sprites[i].hitType.ceilingZ → geta[ri].htceilingz ra
sprites[i].hitInfo.wall     → geta[ri].htg_t 6 ra
```

Sub-objects are entries with `type: CON_NATIVE_FLAGS.OBJECT` in a `nativeVars_*` array and an `object: CON_NATIVE_VAR[]` child array in `native.ts`. `visitMemberExpression` recurses into this child array on nested property access.

**Naming convention:**
- **`C` prefix** — Class (can be `extend`ed by user code): `CActor`, `CEvent`, `CPlayer`, `CSector`, `CWall`
- **`I` prefix** — Interface (struct shape only, used as a type annotation): `IProjectile`, `ITSprite`, `IUserDef`, `ITileData`, `IPalData`, `IInput`

---

## Part IX — Pre-compiled Modules and Libraries

### Section 31 — Pre-compiled Modules

The five modules in `src/sets/TCSet100/precompile/src/` are written in TypeScript/TypeCON and compiled once via `yarn build` (via `postBuild.js`) to `precompile/generated/*.con`. They are appended to every linked output (unless `--no-precompiled`).

`GetPrecompiledCode()` in `framework.ts` reads all `.con` files from the `asm/` or `generated/` folder, deduplicates by defstate name (the same defstate from different builds is never emitted twice), and returns a single concatenated string.

Pre-compiled defstates that internally use `rfx0`–`rfx3` (e.g. `_convertFP2String`) must save and restore them via `flat[]`, because compiler-generated code may have live expression values spilled there at the call site.

| Module | Key defstates | Purpose |
|---|---|---|
| `_recFuncs.ts` | `_rec_alloc`, `_rec_hash`, `_rec_get`, `_rec_set`, `_rec_del`, `_rec_resize`, `_rec_free` | `Record<string,T>` runtime |
| `_mathFuncs.ts` | `_Math_pow`, `_Math_powFP`, `_Math_log`, `_Math_logFP`, `_Math_log2`, `_Math_log10` | Math helpers |
| `_drawFuncs.ts` | `TextMultiLine`, `TextMultiLineClipped` | Multi-line screen text |
| `_spriteFuncs.ts` | `CanSeeShootInDist`, `ActionAndMove` | Sprite logic helpers |
| `_stringFuncs.ts` | `_stringToFP16`, `_checkEq`, `_convertInt2String`, `_convertFP2String`, `_convertString2Quote`, `_stringConcat` | String and test utilities |

---

### Section 32 — AnimUtils Library

`AnimUtils.ts` provides animation and timing utilities, all operating in FP16 (Q15.16) space.

```typescript
// Interpolation
AnimUtils.lerp(a, b, t: FP16): FP16            // a + (b-a)*t
AnimUtils.smoothstep(t: FP16): FP16             // 3t² - 2t³
AnimUtils.smootherstep(t: FP16): FP16           // 6t⁵ - 15t⁴ + 10t³

// Easing
AnimUtils.easeInQuad(t): FP16                   // t²
AnimUtils.easeOutQuad(t): FP16                  // 1-(1-t)²
AnimUtils.easeInOutQuad(t): FP16
AnimUtils.easeInCubic(t): FP16
AnimUtils.easeOutCubic(t): FP16
AnimUtils.easeInQuint(t): FP16
AnimUtils.easeOutQuint(t): FP16
AnimUtils.easeInSine(t): FP16                   // uses Math.cos internally
AnimUtils.easeOutSine(t): FP16
AnimUtils.easeInOutSine(t): FP16
AnimUtils.easeInPow(t, power: number): FP16
AnimUtils.easeOutPow(t, power: number): FP16
AnimUtils.bezierQuad(a, b, c, t: FP16): FP16

// Misc
AnimUtils.pingPong(t, period: number): number
AnimUtils.oscillateFP(t, period: number): FP16
AnimUtils.approach(curr, target, step: number): number
AnimUtils.pulse(t, period, duty: number): number
```

All FP16 arithmetic internally emits `mulscale`/`divscale 16` via the standard FP16 code generation path.

---

### Section 33 — CFile Library

`CFile` provides file I/O via the Build Engine's `readarrayfromfile` and `writearraytofile` CON instructions.

**Read flow:**
1. `CFile.Read(type, encoding)` uses `readarrayfromfile rstack <path>` to load the file into the `rstack` intermediate buffer (24-slot CON array).
2. The buffer is then transposed into the `flat[]` heap via `CONUnsafe()` for high-performance raw CON injection.
3. Returns the heap string pointer (text mode) or raw integer array (binary mode).

**Modes:**
- **Binary** (`type=0`): reads raw 32-bit values directly.
- **Text** (`type=1`, `encoding=8|16|32`): reads as ASCII/UTF-16/UTF-32 character codes, converts to a flat string.

`CONUnsafe()` is used heavily throughout `CFile` to inject raw CON instructions that bypass the TypeScript expression parser, providing direct buffer-to-flat memory copy at native CON performance.

**Typical usage:**
```typescript
const f = new CFile('data/config.json');
const text: string = f.Read(1, 8);  // text mode, 8-bit encoding
const doc: CJson = JSON.parse(text);
```

---

### Section 34 — TCUI and TCDebug Libraries

#### TCUI (`TCUI.ts`)

`TCUI` is an ImGUI/Nuklear-style immediate-mode UI class. All layout state lives inside the class's own `flat[]` object fields — **zero heap allocation per frame**.

**Internal fields** (stored as object properties in flat[]):

| Field | Purpose |
|---|---|
| `cx, cy, cw, ch` | Container bounds |
| `px, py` | Layout cursor (current draw position) |
| `mode` | Layout direction: 0=vertical, 1=horizontal |
| `max` | Max items per row/column |
| `grow` | 1=wrap, 0=stop at max |
| `iw, ih` | Item width/height |
| `idx` | Current item index |
| `fontTile, fontXSpace, fontYLine` | Font settings |
| `shade, pal, orientation` | Style settings |

**API:**
```typescript
ui.beginContainer(x, y, w, h)      // reset cursor and bounds
ui.setLayout(x, y, w, h, mode)     // configure layout
ui.setFont(tile, xspace, yline, xbetween, ybetween, flags)
ui.setStyle(shade, pal, orientation)
ui.text(s: string)                  // draw text at cursor, advance
ui.sprite(tile, shade, pal, orient) // draw sprite at cursor, advance
ui.endContainer()                   // reset item counter
```

#### TCDebug (`TCDebug.ts`)

`TCDebug` renders a two-line stack/heap usage overlay. **Importing the file activates it** — it self-hooks `EVENT_DISPLAYEND` via a `CEvent` class with `super('DisplayEnd')`.

```typescript
import './include/TCSet100/TCDebug';
// Toggle: setvar TCDEBUG_MODE 1  (from EDuke32 console)
// Bake:   tcc make --vars TCDEBUG_MODE=1
```

**Internal state:**
- `_freePages`, `_usedPages`, `_markedPages` — counts computed each frame by `_countHeapPages()`.
- `_countHeapPages()` iterates `allocTable` to categorise each page: free (0), marked (has bit 1024), or used.
- `ShowDebugInfo()` renders the overlay via `TCUI`.

---

## Part X — CON Validator

### Section 35 — CON Validator

The CON validator (`src/modules/con-validator/index.ts`) performs static analysis on the linked `.con` file before it is deployed or simulated.

**Two-pass architecture:**

- **Pass 1** — Declaration scan: collects all `defstate`, `gamevar`, `array`, `define`, `action`, `move`, `ai`, and `useractor` names into a known-symbol set.
- **Pass 2** — Reference check: validates all `state <name>` calls refer to declared defstates; struct field accesses (e.g. `geta[ri].extra`) use valid field names; `appendevent`/`onevent` event names are in the known list; `getactorvar`/`setactorvar` use `GAMEVAR_PERACTOR` variables.

**Resource limit checking:** `warnNearLimits: true` in `typecon.json` enables warnings when the output approaches EDuke32 hard limits (number of gamevars, array count, string table entries, etc.).

**Integration:** `tcc make validate` runs the validator standalone; `tcc make` runs it automatically after linking unless `validate.enabled` is `false`.

---

## Part XI — CON VM Simulator

### Section 36 — CON VM Simulator Architecture

The CON VM simulator (`src/modules/con-vm/`) is a full CON bytecode interpreter that runs compiled `.con` output without EDuke32.

```
  .con file text
       │
       ▼
  ┌─────────────┐
  │  Parser.ts  │  tokenise + build Statement[] instruction list
  │             │  handles: defstate…ends, actor…enda, appendevent…endevent,
  │             │  gamevar/var, array, define, action, move, ai, …
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────────────┐
  │  Interpreter.ts                     │
  │                                     │
  │  execute(entry: string): VMRunResult│
  │                                     │
  │  VMState:                           │
  │    vars: Map<string, number>        │  all gamevars (registers + user)
  │    arrays: Map<string, number[]>    │  flat[], rstack, allocTable, …
  │    quotes: Map<number, string>      │  engine quote strings
  │    actorFields: Map<string, number> │  [index]fieldName → value
  │    playerFields: Map<string, number>│
  │    sectorFields: Map<string, number>│
  │    wallFields: Map<string, number>  │
  │    callStack: string[]              │  defstate name stack
  └─────────────────────────────────────┘
         │
         ▼
  ┌─────────────┐
  │  Memory.ts  │  flat[] bounds checking; peakRsp; peakFlatIdx
  │  Tables.ts  │  sintable (BUILD sin/cos); getangle lookup
  └─────────────┘
```

**Supported opcodes (~55):**
- Arithmetic: `add`, `sub`, `mul`, `div`, `mulscale`, `divscale`, `mod`, `shiftl`, `shiftr`
- Comparison: `ife`, `ifn`, `ifl`, `ifg`, `ifle`, `ifge`, `ifvarand`, `ifvarn`, `ifvarl`, `ifvarg`, `ifvarle`, `ifvarge`
- Array ops: `setarray`, `getarraysize`, `resizearray`, `copy`
- String ops: `qputs`, `qstrcpy`, `qsprintf`, `qgetsysstr`, `qstrncat`
- Control flow: `while`/`whilen`, `switch`/`endswitch`, `state`, `exit`, `jump`, `getcurraddress`, `for VAR allsprites`
- Math: `sqrt`, `sin`, `cos`, `krand`
- File I/O: `readarrayfromfile`, `writearraytofile`
- Per-actor gamevars: `getactorvar[I].FIELD DST`, `setactorvar[I].FIELD SRC`

**`_pCptr` mirroring:** writes to `_pCptr` (`set _pCptr rb`) are automatically mirrored to `actorFields` so the GC `allsprites` scan can find per-actor allocations during simulation.

**Actor test support:** `// debug-test` on a `CActor.Main()` method compiles in `//// DEBUG-TEST ////` + `state _testInit`. The VM fires `EVENT_SPAWN` before executing the actor body so `_pCptr` is initialised.

---

### Section 37 — CLI Simulation Flags

| Flag | Description |
|---|---|
| `-S`, `--sim` | Run the CON VM simulator on the input `.con` |
| `--state NAME` | Run a specific `defstate` instead of the full init sequence |
| `--actor PICNUM` | Run a specific actor block (`EVENT_SPAWN` fires first) |
| `--event NAME` | Run a specific event handler |
| `--no-init` | Skip init events; useful for unit-testing individual states |
| `--mem` | Print per-phase stack HWM and page-based heap accounting |
| `--test` | Aggregate `checkEq`/`checkFpEq` results; exit `0`/`1` |
| `--2-pass-gc` | Run GC twice — converts "marked to free" into "reclaimed" |
| `--strict-int` | Throw on NaN or decimal values written to any CON variable |
| `--no-validate`, `-nv` | Skip pre-simulation CON validator |
| `--report FILE` | Write JSON report: memory stats, test results, variables, `flatMemory` snapshot |
| `--set-field-actor [I]f=v` | Pre-seed an actor struct field |
| `--set-field-player [I]f=v` | Pre-seed a player struct field |
| `--set-field-sector [I]f=v` | Pre-seed a sector struct field |
| `--set-field-wall [I]f=v` | Pre-seed a wall struct field |

**`--report` JSON structure:**
```json
{
  "memory": { "peakRsp": 42, "heapPages": 7, "freePages": 121 },
  "tests":  { "total": 8, "passed": 8 },
  "vars":   { "_testCounter": 8208 },
  "actorFields": { "[0]extra": 100 },
  "flatMemory": {
    "stack": [0, 0, 1, 65536, …],
    "heapPages": [
      { "address": 1024, "typeLabel": "string", "sizeWords": 8, "data": [5,104,101,108,108,111,0,0] }
    ]
  }
}
```

---

## Part XII — Testing Infrastructure

### Section 38 — Debug-Test Framework

The debug-test framework enables in-process unit testing of compiled CON output via the `checkEq` / `checkFpEq` functions.

**How it works:**

1. A `// debug-test` comment on a `CEvent.Append()`, plain defstate, or `CActor.Main()` method enables test mode for that block.

2. The compiler emits:
   ```con
   //// DEBUG-TEST ////
   state _testInit          ; _testCounter = 0
   set rb _testCounter
   ```

3. Every `checkEq(a, b)` call site gets injected:
   ```con
   add _testCounter 4096    ; increment total count (upper 12 bits)
   ife <a_expr> <b_expr>
   add _testCounter 1       ; increment pass count (lower 12 bits)
   ```

4. `checkFpEq(a, b)` uses an FP16-aware approximate comparison before the `ife`.

5. After simulation, `--test` decodes `_testCounter`:
   - `total = _testCounter >> 12`
   - `passed = _testCounter & 0xFFF`

**CLI output:**
```
[PASS] TestMath::Append    4/4
[FAIL] BadMath::Test       2/3   (1 failure)
Result: 6/7 passed
```

Exit code `0` = all passed; `1` = at least one failed — compatible with CI pipelines.

The 12-bit encoding limits each block to 4095 total tests and 4095 passes. Blocks with more assertions should be split.

---

### Section 39 — tcc test Runner

`src/modules/test-runner/index.ts` orchestrates the full compile → link → simulate → assert pipeline from a single JSON script.

**Script schema:**
```json
{
  "source": "examples/tests/math/test_math.ts",
  "scenarios": [
    {
      "name": "basic math",
      "setup": {
        "actorFields": { "[0]extra": 42 },
        "playerFields": { "[0]health": 100 }
      },
      "expect": [
        { "type": "eq", "target": "var",        "name": "_testCounter", "value": 4096 },
        { "type": "eq", "target": "actorField", "index": 0, "field": "extra", "value": 42 },
        { "type": "gt", "target": "var",        "name": "rb", "value": 0 }
      ],
      "defaultInclusion": false,
      "memTest": false,
      "validate": true
    }
  ]
}
```

**Assertion types:**

| `type` | Operators | `target` options |
|---|---|---|
| `eq` / `ne` | exact / not | `var`, `actorField`, `playerField`, `sectorField`, `wallField` |
| `gt` / `lt` / `ge` / `le` | numeric | same |

The runner exits `0` if all scenarios pass, `1` otherwise — compatible with `run-tests.sh` / `run-tests.bat`.

---

## Part XIII — tcc CLI and Build System

### Section 40 — tcc CLI Reference

```
tcc setup                       Interactive project setup (src/, include/, tsconfig.json, VS Code)
tcc make                        Full pipeline (see Section 41)

Compile options:
  -c, --compile                 Compile to .tco (intermediate) instead of .con
  -i  <file>                    Input TypeScript file
  -il <files...>                Batch input list
  -if <folder>                  Compile all .ts files in a folder
  -m, --module                  Module mode (single file)
  -ic, --intermediate-code      Write raw CON with markers to asm/
  -sc, --share-context          Share symbol table across all input files
  -dl, --detail-lines           Emit original TS lines as CON comments
  -sp, --symbol-print           Print symbol table to symbols.txt / symbols.json

Link options:
  -L, --linker                  Link .tco files to .con
  -o  <file>                    Output filename (default: EDUKE.CON)
  -of <folder>                  Output folder (default: compiled/)
  -di, --default-inclusion      Include GAME.CON at the top of output
  -ei, --eduke-init             Use EDUKE.CON as the init filename
  -sep, --separate              Output each module as a separate .con file
  -Cm, --con-module             Output a relocatable CON module
  -hl, --headerless             Exclude CONInit framework from output
  -h, --header                  Generate a separate header.con
  -ci, --create-init            Generate an init.con linking all files
  -np, --no-precompiled         Skip linking of pre-compiled system modules
  -ss <n>                       Stack size (default 1024; recommend >1024)
  -hs <n>                       Heap size
  -ps <n>                       Heap page size (default 4)
  -pn <n>                       Number of heap pages (default 128)
  --vars NAME=VALUE             Override gameVar initial values at link time

Simulator options:
  -S, --sim <file>              Run CON VM simulator
  --state <name>                Run specific defstate
  --actor <picnum>              Run specific actor (EVENT_SPAWN fires first)
  --event <name>                Run specific event
  --no-init                     Skip init events
  --mem                         Print stack HWM and heap accounting
  --test                        Aggregate checkEq results; exit 0/1
  --2-pass-gc                   Run GC twice after entry point
  --strict-int                  Error on NaN/decimal writes
  --no-validate, -nv            Skip pre-sim CON validation
  --report <file>               Write JSON simulation report

Test options:
  tcc test <script.json>        Run .test.json multi-scenario test harness

Misc:
  -C, --clean                   Delete *.tco, *.icc, *.con from obj/, asm/, compiled/
  -C precompiled                Also clean precompile/generated/*.con
  -V, --validate <file>         Run CON validator on a .con file
  -?, --help                    Print help text
```

---

### Section 41 — typecon.json Configuration

`typecon.json` is the project build manifest for `tcc make`. All fields are optional; unset fields fall back to the same defaults as the equivalent CLI flags.

**`MakeConfig` interface** (`src/modules/make/types.ts`):

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | directory name | Project name |
| `sources` | `string[]` | `["src/**/*.ts"]` | Glob patterns for TypeScript source files |
| `objDir` | `string` | `"obj"` | Output folder for `.tco` files |
| `outputDir` | `string` | `"compiled"` | Output folder for `.con` files |
| `output` | `string` | `"EDUKE.CON"` | Output filename |
| `stackSize` | `number` | `1024` | VM stack size |
| `heapPageSize` | `number` | `4` | Heap page size in words |
| `heapPageNumber` | `number` | `128` | Number of heap pages |
| `defaultInclusion` | `boolean` | `false` | Include GAME.CON at top of output |
| `precompiledModules` | `boolean` | `true` | Link pre-compiled system modules |
| `modules` | `ModuleEntry[]` | `[]` | Per-file enable/disable/required flags |
| `validate` | `ValidateConfig` | `{}` | Validator settings |
| `locked` | `string[]` | `[]` | Fields that `tcc make config` cannot edit |
| `vars` | `Record<string, number>` | `{}` | `gameVar` initial value overrides |
| `tests` | `string[]` | `[]` | `.test.json` or `.ts` test files for `tcc make test` |

**`modules[]` entry:**
```json
{ "path": "src/actors/Boss.ts", "enabled": true, "required": true }
```
`required: true` means the file cannot be disabled via `tcc make config`.

**`validate` sub-object:**
```json
{ "enabled": true, "warnNearLimits": true, "baseDirs": ["baseCON"] }
```

**Lock system:** any field key in `locked[]` is shown in `tcc make config` but cannot be edited. Adding `"locked"` to its own array hides the lock UI entirely.

---

## Part XIV — Appendices

### Appendix A — CON Opcode Glossary

Key opcodes supported by the CON VM simulator (`Types.ts`):

| Opcode | Parameters | Description |
|---|---|---|
| `set` | `dst src` | Assign value |
| `add` | `dst val` | Add |
| `sub` | `dst val` | Subtract |
| `mul` | `dst val` | Multiply |
| `div` | `dst val` | Divide |
| `mod` | `dst val` | Modulo |
| `mulscale` | `dst a b shift` | `dst = a*b >> shift` |
| `divscale` | `dst a b shift` | `dst = a*65536/b >> (16-shift)` |
| `shiftl` | `dst val` | Left shift |
| `shiftr` | `dst val` | Right shift |
| `ife` | `a b` | If equal: execute next block |
| `ifn` | `a b` | If not equal |
| `ifl` | `a b` | If a < b |
| `ifg` | `a b` | If a > b |
| `ifle` | `a b` | If a <= b |
| `ifge` | `a b` | If a >= b |
| `ifvarand` | `a b` | If a & b != 0 |
| `ifvarn` | `a b` | If variable a != b |
| `setarray` | `arr[i] val` | Write array element |
| `getarraysize` | `arr dst` | Array length → dst |
| `resizearray` | `arr newsize` | Grow/shrink array |
| `copy` | `src[i] dst[j] n` | Copy n elements |
| `state` | `name` | Call a defstate |
| `exit` | — | Break out of innermost while/for |
| `jump` | `addr` | Unconditional jump to address |
| `getcurraddress` | `dst` | Store current PC in dst |
| `whilen` | `var val { }` | Loop while var != val |
| `switch` / `endswitch` | — | Switch statement |
| `qputs` | `quote str` | Write string to quote |
| `qstrcpy` | `dst src` | Copy quote |
| `qstrncat` | `dst src n` | Append n chars |
| `qsprintf` | `dst fmt …` | Format string into quote |
| `sqrt` | `val dst` | Integer square root |
| `sin` | `val dst` | sin(val/2048 * 2π) → sintable |
| `cos` | `val dst` | cos equivalent |
| `krand` | `dst` | Pseudo-random number |
| `readarrayfromfile` | `arr path` | Load file into array |
| `writearraytofile` | `arr path` | Write array to file |
| `for VAR allsprites` | — | Iterate all sprites |
| `getactorvar[i].FIELD dst` | — | Read per-actor gamevar field |
| `setactorvar[i].FIELD src` | — | Write per-actor gamevar field |

---

### Appendix B — ESymbolType Bit Reference

| Decimal | Hex | Name | Description |
|---|---|---|---|
| 0 | 0x00000 | `error` | Unresolved / invalid symbol |
| 1 | 0x00001 | `number` | Plain 32-bit integer |
| 2 | 0x00002 | `string` | Heap string pointer |
| 4 | 0x00004 | `boolean` | Boolean (0 or 1) |
| 8 | 0x00008 | `object` | Heap object pointer |
| 16 | 0x00010 | `pointer` | Native struct index |
| 32 | 0x00020 | `function` | User-defined defstate |
| 64 | 0x00040 | `native` | Native CON symbol |
| 128 | 0x00080 | `quote` | Quote string |
| 256 | 0x00100 | `class` | Class definition |
| 512 | 0x00200 | `array` | Heap array pointer |
| 1024 | 0x00400 | `null` | Null literal |
| 2048 | 0x00800 | `module` | Namespace / module |
| 4096 | 0x01000 | `enum` | Enum definition |
| 8192 | 0x02000 | `constant` | Compile-time constant |
| 65536 | 0x10000 | `not_compiled` | Declaration-only |
| 131072 | 0x20000 | `sub_function` | Arrow/function expression reference |
| 262144 | 0x40000 | `fixed_point` | Fixed-point value |
| 524288 | 0x80000 | `record` | Record<string,T> hash map |

**EHeapType flags** (used in `allocTable`):

| Value | Name | Description |
|---|---|---|
| 1 | `array` | Heap array block |
| 2 | `string` | Heap string block |
| 4 | `object` | Heap object block |
| 8 | `string_array` | Array of strings |
| 16 | `peractor` | Per-actor property block |
| 1024 | *(GC mark)* | ORed in during sweep; cleared if live |

---

### Appendix C — Diagnostics Reference

The compiler collects diagnostics via `addDiagnostic(node, context, severity, message)`. Errors halt code generation for the affected statement; warnings allow it to continue.

**Common errors:**

| Origin | Message |
|---|---|
| `visitStatement.ts` | `for...in is not supported in TypeCON` |
| `visitBinaryExpression.ts` | `Cannot mix FP precisions: FP16 and FP11` |
| `visitCallExpression.ts` | `Unknown function: <name>` |
| `visitClassDeclaration.ts` | `CActor constructor may only contain super() and property initialization` |
| `visitForOfStatement.ts` | `for-of target must be a heap array` |
| `visitMemberExpression.ts` | `Unknown native struct field: <field>` |

**Common warnings:**

| Origin | Message |
|---|---|
| `visitStatement.ts` | `Unhandled statement kind: <kind>` |
| `visitVariableDeclaration.ts` | `Record stack size exceeds recommended limit` |

Diagnostics are propagated through `CompileResult.diagnostics[]` and printed to stderr with file and line number after compilation.

---

### Appendix D — Extending TypeCON

#### Adding a new visitor

1. Add a new `case SyntaxKind.XxxStatement:` entry to `visitStatement.ts`.
2. Create `services/visitXxxStatement.ts` following the pattern: `(stmt: XxxStatement, context: CompilerContext): string`.
3. Append CON code to `code` string and return it.
4. If the visitor allocates locals, increment `context.localVarCount` and emit `add rsp 1; setarray flat[rsp] <val>`.

#### Adding a new pre-compiled module

1. Write the TypeScript source in `src/sets/TCSet100/precompile/src/_myModule.ts`.
2. If your defstate uses `rfx0`–`rfx3` internally, save them to `flat[]` at entry and restore at every exit — compiler-generated code may have live `rd` spill values there at your call site.
3. Document the calling convention (which registers hold inputs and outputs).
4. Run `yarn build` — `postBuild.js` will compile it to `precompile/generated/_myModule.con`.
5. `GetPrecompiledCode()` picks it up automatically.

#### Adding a new native function

Add an entry to the `nativeFunctions` array in `src/sets/TCSet100/native.ts`:

```typescript
{
  name: 'myFunc',
  code: (args) => `mynative ${args[0]} ${args[1]}\n`,
  arguments: [CON_NATIVE_FLAGS.VARIABLE, CON_NATIVE_FLAGS.CONSTANT],
  returns: ESymbolType.number,
  object_belong: 'CActor',
}
```

#### Adding a new register

1. Add `var newReg 0 REG_FLAGS` to `CONInit.initCode` in `framework.ts`.
2. Add a row to the register table in Section 6 of this document.
3. If the register needs saving/restoring across calls, add a `push`/`pop` helper pair to `initStates`.
4. Update `CompilerContext` if the compiler needs to track allocation state for this register.
