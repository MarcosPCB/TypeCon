# Native Sets (TCSet100) Skill

The `src/sets/TCSet100` directory is the bridge between TypeScript and the Build Engine's hardcoded entities, providing type safety and code-generation rules.

## Core Components

### `types.ts`
Contains all TypeScript type definitions visible to the modder:
- Native struct classes/interfaces (e.g. `CActor`, `CSector`, `CWall`, `CPlayer`)
- Special type wrappers that signal compiler behavior (see below)
- Base classes for event/actor handlers (`CActor`, `CEvent`, `CInput`)
- Fixed-point numeric types (`FP11`, `FP14`, `FP16`, `FP30`)

### `native.ts`
Contains the `nativeFunctions` array — the translation map that tells the compiler how to convert a TypeScript method call into CON instructions. Some mappings are simple strings (`"fall "`), while complex mappings use arrow functions to emit multiple dynamic instructions. Also defines `nativeVars_*` arrays (one per struct) used by `visitMemberExpression` to resolve property names to CON field codes.

### `DN3D/game.ts`
Classic Duke3D enumerations: tile Names, Sounds, Music IDs.

### `precompile/src/` + `precompile/generated/`
Reusable TypeScript modules that are compiled to `.con` files automatically during `yarn build` via `postBuild.js`. Shipped alongside the tool. Currently: `_mathFuncs`, `_stringFuncs`, `_spriteFuncs`, `_drawFuncs`, `_recFuncs`.

### `AnimUtils.ts`
Animation dispatch library. Provides: `lerp`, `smoothstep`, all standard easing functions (`easeIn`, `easeOut`, `easeInOut`, etc.), `bezierQuad`, `pingPong`, `oscillateFP`, `approach`, `pulse`. Values operate in FP16 space.

### `CFile.ts`
File I/O class using EDuke32's `readarrayfromfile` / `writearraytofile`. Uses `rstack` (the engine's array) as an intermediate buffer, then copies data into the `flat` heap. Uses `CONUnsafe()` extensively to inject raw high-performance CON instructions directly.

### `CJson.ts`
Recursive-descent JSON parser and builder that runs entirely in the CON VM. Parses a heap-allocated string into a tree of typed nodes (`Null`, `Bool`, `Int`, `FP16`, `String`, `Array`, `Object`). API: `Parse()`, `Find(key)`, `GetItem(i)`, `GetInt()`, `GetString()`, `Stringify()`, `ToRecord()`, `Free()`. Used via the `JSON` namespace alias (`JSON.parse` / `JSON.stringify`).

### `JSON.ts`
Thin namespace alias that mirrors JavaScript's `JSON` global:
- `JSON.parse(text)` → `new CJson(text)`
- `JSON.stringify(node)` → `node.Stringify()`

### `TCDebug.ts`
Runtime debug overlay that self-hooks `EVENT_DISPLAYEND` — importing the file activates it. Toggle with `setvar TCDEBUG_MODE 1` (from EDuke32 console) or bake with `--vars TCDEBUG_MODE=1`. Also exports a SimReport-compatible JSON report (memory, heap pages, all framework gamevars) via `--report`.

### `TCUI.ts`
ImGUI/Nuklear-style immediate-mode UI class. Internal layout state lives in `flat[]` object fields — zero heap allocation per frame. Usage: `beginContainer` → `setLayout` → `text`/`sprite` → `endContainer`.

### `nws.ts`
Network/socket operations module.

---

## Special Type Aliases

| Type | Meaning |
|---|---|
| `CON_NATIVE<T>` | Property maps to a native engine struct field — **not** allocated in `flat[]`. Used on all native struct properties. |
| `CON_CONSTANT<T>` | Value is a compile-time literal, emitted inline as a number rather than a variable reference. |
| `CONUnsafe(s: string)` | Injects the raw CON string `s` directly into the output stream, bypassing the expression parser. For performance-critical or unsupported instructions. |

---

## Fixed-Point Types

Four branded `number` intersection types for fixed-point arithmetic:

| Type | Scale | 1.0 = | Typical use |
|---|---|---|---|
| `FP11` | Q20.11 | 2048 | BUILD engine BAM angles (0–2047 = full circle) |
| `FP14` | Q17.14 | 16384 | Engine sin/cos return values (−16384 … 16384) |
| `FP16` | Q15.16 | 65536 | General fixed-point math, zoom, coordinates |
| `FP30` | Q1.30 | 1073741824 | Unit-range values requiring high precision |

The compiler automatically emits `mulscale`/`divscale` instead of `mul`/`div` when both operands of a `*` or `/` expression share the same FP precision. Mixing precisions is a compile-time error.

**Conversion helpers** (one set per precision):
```typescript
intToFP16(x)      // shift left 16
fp16ToInt(x)      // shift right 16
fp16Raw(x)        // return raw integer (no shift — for APIs that expect the 16.16 bit pattern)
fp16ToString(x)   // "1.5000" format via _convertFP2String defstate
fp16FromString(s) // parse "1.5000" back to FP16
// Same pattern for FP11, FP14, FP30
```

---

## Base Classes

### `CActor`
Extend to create a Duke3D actor. Constructor takes `(picnum, isEnemy?, extra?)`. Implement `Main()` for the main actor loop. Emits a CON `actor`/`useractor` block.

### `CEvent`
Extend to hook a game event. Constructor takes an event name string (e.g. `super('NewGame')`). Implement `Append()` / `Prepend()` to emit `appendevent` / `onevent` blocks.

### `CInput`
Extend to handle `EVENT_PROCESSINPUT`. No constructor needed. Implement `Append()` / `Prepend()` — automatically emits `appendevent EVENT_PROCESSINPUT` / `onevent EVENT_PROCESSINPUT`.

---

## Native Struct Arrays

Ten global arrays expose engine data. All use the pattern `get<op>[ri].<field> ra` / `set<op>[ri].<field> ra` in CON:

| TS global | CON op | Interface | Description |
|---|---|---|---|
| `sprites[]` | `a` | `CActor` | All sprites/actors in the map |
| `sectors[]` | `sector` | `CSector` | All sectors (ceiling/floor as `ISectorBase`) |
| `walls[]` | `wall` | `CWall` | All walls |
| `players[]` | `p` | `CPlayer` | All player slots |
| `projectiles[]` | `projectile` | `IProjectile` | Per-tile projectile definitions |
| `tsprites[]` | `tspr` | `ITSprite` | Renderer draw list (current frame only) |
| `userdef[]` | `userdef` | `IUserDef` | Global game settings |
| `input[]` | `input` | `IInput` | Per-player raw input state |
| `tiledata[]` | `tiledata` | `ITileData` | Per-tile art metadata (read-only) |
| `paldata[]` | `paldata` | `IPalData` | Per-palette flags (read-only) |

`visitMemberExpression` excludes all these names from symbol-table lookup and routes them directly to the CON accessor switch.

### Singleton Shorthands

Three globals have index-free singleton forms that auto-emit a default `ri`:

| Expression | Emits | Use case |
|---|---|---|
| `userdef.field` | `set ri 0` | Engine config — always index 0 |
| `input.field` | `set ri myconnectindex` | Current player's input — use inside `CInput` |
| `player.field` | `set ri THISACTOR` | Connected player — use inside `CActor` |

Typed as `IUserDef[] & IUserDef`, `IInput[] & IInput`, and `CPlayer` respectively. The indexed forms (`userdef[0]`, `input[i]`, `players[i]`) continue to work normally.

### Sub-Object Groupings

Some structs expose logical sub-objects that are a TypeScript-side convenience — they compile identically to the flat field. Defined with `type: CON_NATIVE_FLAGS.OBJECT` and a child `object: CON_NATIVE_VAR[]` array in `native.ts`. Example:
```
projectiles[i].audio.fire   →  getprojectile[ri].isound ra
input[i].motion.forward     →  getinput[ri].fvel ra
sprites[i].hitType.ceilingZ →  geta[ri].htceilingz ra
```

---

## Native `Record<string, T>` Hash Map

`Record<string, T>` is a compiler-native hash map backed by the `_recFuncs` precompiled module.

**Heap layout:**
```
flat[ptr + 0]            = capacity  (power-of-2; default 16)
flat[ptr + 1]            = count     (live entries)
flat[ptr + 2 + i*2 + 0] = hash      (0 = empty, -1 = tombstone)
flat[ptr + 2 + i*2 + 1] = value
```

**Compile-time behaviour:**
- Empty literal `{}` emits `state _rec_alloc`.
- String-literal keys: FNV-1a hash computed **at compile time** — zero runtime hashing cost.
- Runtime keys (variables/expressions): emits `state _rec_hash` before the lookup/store.
- Chained access (`r["a"]["b"]`) emits all `_rec_get` calls in order.
- Table auto-doubles (`_rec_resize`) when `count > capacity * 3 / 4`.

---

## `gameVar` Type

`gameVar` declares a native EDuke32 gamevar directly from TypeScript:

```typescript
const TCDEBUG_MODE: gameVar = 0;   // → gamevar TCDEBUG_MODE 0 REG_FLAGS
```

- Detected by `visitVariableDeclaration` via the alias name `'gameVar'`.
- Emits `gamevar NAME VALUE REG_FLAGS` into `context.gameVarDeclarations[]`, prepended to output before any `defstate` (required by EDuke32's single-pass parser).
- Reads emit `set ra VARNAME`; writes emit `set VARNAME ra` — no `flat[]` indirection.
- Initial value can be overridden at build time: `--vars NAME=VALUE` (baked into the `gamevar` declaration).

---

## Agent Guidelines
- To expose a new EDuke32 field: declare it in `types.ts` (with `CON_NATIVE<T>`) and add an entry to the corresponding `nativeVars_*` array in `native.ts`.
- To add a new native function/command: add an entry to `nativeFunctions` in `native.ts`.
- After **any** change inside `src/sets/` — including `CJson.ts`, `TCDebug.ts`, `TCUI.ts`, `JSON.ts`, `AnimUtils.ts` — run `yarn build` so that `postBuild.js` copies the updated definitions into the `include/` directory shipped with the npm package.
- `CActor` main loop method is `Main()`. `CEvent` handler methods are `Append()` / `Prepend()`. Do not confuse the two.
