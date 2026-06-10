# CON Validator Module Skill

The `src/modules/con-validator` module is a two-pass linter and semantic analyzer for EDuke32 CON script files. It validates structure, symbol references, and field names against EDuke32 engine limits before the output is run or shipped.

## Core Files

| File | Purpose |
|---|---|
| `index.ts` | Entry point: `validateCON()`, include resolution, pass orchestration |
| `SymbolTable.ts` | `SymbolTable` class — declaration tracking and limit enforcement |
| `Tokenizer.ts` | Lexer — token stream with struct accessor support |
| `Validator.ts` | Pass 1 (collect) + Pass 2 (validate) logic |
| `data/keywords.ts` | 300+ CON keyword metadata (opener/closer, topLevelOnly, etc.) |
| `data/builtinSymbols.ts` | Built-in gamevars/arrays and EDuke32 resource limit constants |
| `data/events.ts` | All 172 `EVENT_*` names + `MAXEVENTS` constant |
| `data/structFields.ts` | `STRUCT_FIELD_MAP` — valid fields per struct for accessor validation |

## Entry Point

```typescript
validateCON(text: string, opts?: ValidateOptions): ValidationResult
```

`ValidateOptions`: `{ warnNearLimits?: boolean, baseDirs?: string[] }`

`ValidationResult`: `{ ok: boolean, diagnostics: Diagnostic[], symbolTable: SymbolTable, includedFiles: IncludedFileResult[] }`

## Two-Pass Algorithm

### Pass 1 — Symbol Collection
- Tracks block depth to distinguish top-level declarations from inline calls
- Collects: `gamevar`, `gamearray`, `define`, `state`/`defstate`/`appendstate`/`prependstate`, `action`, `move`, `ai`, `actor`/`useractor`, `onevent`/`appendevent`
- Enforces: name length ≤ 26 chars, no redeclaration of built-ins, resource limits (warns at 90% capacity)
- Directives that consume the rest of the line (e.g. `definequote N <text>`) skip to EOL

### Pass 2 — Structural Validation
- Maintains a `BlockFrame` stack to track opener/closer pairs (`defstate/ends`, `actor/enda`, `onevent/endevent`, `switch/endswitch`)
- Validates:
  - Block closer matches its opener
  - `topLevelOnly` keywords (e.g. `gamevar`) are not used inside a block
  - Event names are in the 172-entry `EVENT_*` list
  - Actor tile IDs are in range `[0, 30720)`
  - `state` calls reference a declared state; warns on forward references
  - Struct field names are valid per `STRUCT_FIELD_MAP`
  - `continue` is only used inside a loop block
  - `break`/`exit` are only used inside a breakable block
  - Float literals produce `ERROR_FLOAT_LITERAL` (compiler must pre-convert)
  - `add flat[ri] x` style array arithmetic produces `ERROR_ARRAY_ARITH_DST`

## EDuke32 Resource Limits

| Constant | Value | Category |
|---|---|---|
| `MAXGAMEVARS` | 2048 | `gamevar` declarations |
| `MAXGAMEARRAYS` | 512 | `gamearray` declarations |
| `MAXLABELS` | 16384 | `state`/`defstate` declarations |
| `MAXVARLABEL` | 26 | Maximum identifier length |
| `MAXTILES` | 30720 | Valid actor tile IDs |
| `MAXQUOTES` | 16384 | Valid quote indices |

## Include Handling
- Extracts `include` / `includedefault` / `includeoptional` directives via regex
- Resolves file paths against `baseDirs` (first match wins)
- DFS collection of all transitive includes before any validation pass runs
- Circular includes are detected and reported
- Per-file diagnostics tracked in `IncludedFileResult[]`

## Symbol Table Output
`SymbolTable.usageSummary()` prints a formatted usage report (counts vs. limits) — this is what the CLI shows on a successful validation run.

## Agent Guidelines
- To add a new CON keyword: add it to `data/keywords.ts` with the correct flag combination (`isBlockOpener`, `blockCloser`, `topLevelOnly`, `isLoop`, `loopOnly`, `breakable`, `takesEventName`, `consumesRestOfLine`, etc.). Wrong flags cause false positives or missed errors.
- To add a new valid struct field: update `data/structFields.ts` in the matching `*_FIELDS` map. The validator rejects any `get/setXXX[ri].field` where `field` is not in the map.
- To expose a new EDuke32 event: add its name to `data/events.ts` and increment `MAXEVENTS`.
- The validator does not execute CON code — it cannot catch runtime errors or logic bugs, only structural and reference issues.
- `warnNearLimits: true` is useful when approaching engine limits; the 90% threshold is hardcoded in `SymbolTable.ts`.
