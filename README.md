# TypeCON — TypeScript compiler for EDuke32 CON

**[BETA v0.9.0]** &nbsp;|&nbsp; [Documentation](https://marcospcb.github.io/TypeCon) &nbsp;|&nbsp; [Technical Architecture](Architecture.md)

Write modern TypeScript, get valid EDuke32 CON scripts — no manual memory management, no raw offset arithmetic, no flag guessing.

---

## What is TypeCON?

EDuke32's CON scripting language was designed in 1996. It has no loops, no typed variables, no functions in the modern sense, and no way to catch mistakes before loading the game. Writing a complex enemy means juggling raw `gamevar` slots, manually unrolling logic with `ifcount` and `ifaction`/`ifmove` chains, and tracking which action or move state you are currently in — one wrong `ifmove` and your enemy silently breaks. Even simple arithmetic requires multiple lines: there is no `x = y * 8 / 3 * y`; you write `set x y`, `mul x 8`, `set rd y`, `mul rd 3`, `div x rd` — and hope you didn't clobber a TEMP/tmp gamevar another part of the code was using.

TypeCON lets you write standard TypeScript — classes, loops, typed fields, objects, fixed-point math — and compiles it down to valid EDuke32 CON. The output is a `.con` file you drop into your mod folder. EDuke32 never knows it came from TypeScript.

TypeCON is aimed at Duke3D modders building new enemies, weapons, events, or HUDs. It is currently in **BETA** (v0.9.0): the language is usable and the examples in this repo compile and run, but generated code is unoptimized and the constructor syntax has some restrictions (see [Limitations](#limitations)).

---

## Why use it?

- Write enemies as TypeScript classes — actions, moves, AI configs, and the main loop all in one place, instead of scattered `ifaction`/`ifmove`/`ifcount` checks across dozens of lines.
- Write arithmetic naturally: `x = y * 8 / 3 * y` instead of manually sequencing `set`, `mul`, `div` instructions and carefully protecting every gamevar.
- Use `for` and `for-of` loops — no more unrolling logic with `ifcount` chains or manually tracking iteration state in a `gamevar`.
- Typed fields on actors and players catch mistakes at edit time, not at EDuke32 launch time.
- Fixed-point math (`FP16`, `FP11`) with automatic `mulscale`/`divscale` — write `angle * 0.5` and get the right instruction.
- Arrays, objects, and strings allocated on a managed heap — no manual `flat[]` slot arithmetic.
- `Record<string, T>` hash maps for key-value lookups.
- JSON parsing and file I/O with `JSON.parse` / `CFile`.
- Built-in HUD system (`TCUI`) and debug overlay (`TCDebug`).
- VS Code plugin with real-time type checking and auto-complete for DN3D tile names, sprite flags, and player fields.
- Test your mod logic without launching EDuke32 — the built-in CON VM Simulator runs compiled output directly.

---

## VS Code Plugin

Running `tcc setup` installs the `typecon_plugin` TypeScript language service plugin automatically. Once installed, VS Code provides real-time type checking and auto-complete across all DN3D tile constants (`DN3D.ENames`), sprite flags (`ESpriteFlags`), player state constants (`EPlayerStates`), and all actor/event method signatures — all without leaving the editor.

> **Note:** VS Code must use the workspace TypeScript SDK, not its bundled one. The `tcc setup` wizard offers to configure this automatically when it detects VS Code.

---

## Quick Start

1. **Install globally:**
   ```bash
   npm install -g typecon
   ```

2. **Create a project** in an empty folder:
   ```bash
   tcc setup
   ```
   This creates `src/`, installs `include/` with native definitions, writes `tsconfig.json` with plugin support, and optionally configures VS Code to use the workspace TS SDK.

3. **Build:**
   ```bash
   tcc make
   ```
   Runs the full compile → link pipeline and writes `compiled/EDUKE.CON`. Drop that file into your EDuke32 mod folder.

---

## Writing Your First Actor

```typescript
import './include/TCSet100/types';
import DN3D from './include/TCSet100/DN3D/game';

const { EXPLOSION2 } = DN3D.ENames;

class MyEnemy extends CActor {
    constructor() {
        super(1234, true, 100);  // tileNum, isEnemy, strength
    }

    Main() {
        if (this.extra <= 0) {         // this.extra = hit-points field
            this.Spawn(EXPLOSION2);    // → CON  spawn EXPLOSION2
            this.KillIt();             // → CON  killit
            return;
        }
        this.PlayAction(this.actions.aWalk);
    }
}
```

Compile it and drop the output into your mod:
```bash
tcc make
# → compiled/EDUKE.CON
```

For a full real-world example — complete with AI states, dodge logic, jetpack behaviour, and a hiding routine — see `examples/actors/AssaultTrooper.ts`.

---

## Key Features

### CActor / CEvent / CPlayer

All game logic lives in class methods. `CActor.Main()` is the per-tick loop. `CEvent` hooks engine events like `DisplayEnd` or `EnterLevel`:

```typescript
class MyHUD extends CEvent {
    constructor() { super('DisplayEnd'); }

    Append() {
        // runs every frame on EVENT_DISPLAYEND
        Native.rotatesprite(160, 30, 65536, 0, SCORE_TILE, 0, 0, 10, 0, 0, 320, 200);
    }
}
```

### for and for-of loops

```typescript
// C-style for loop
for (let i = 0; i < 10; i++) {
    score += i;
}

// Iterate a heap array
const items: number[] = [10, 20, 30];
for (const v of items) {
    total += v;
}
```

The compiler manages all hidden stack slots and loop-variable cleanup automatically.

### Fixed-Point Math (FP16)

EDuke32 has no floating-point. TypeCON uses fixed-point types to represent fractions. Arithmetic emits `mulscale`/`divscale` automatically:

```typescript
let angle: FP11 = 0.25;         // 512 raw — quarter turn
let s: FP14 = Math.sin(angle);  // FP11 in → FP14 out
let x: FP16 = s * 0.5;          // FP14 × scalar → mulscale 14
```

See [Architecture.md](Architecture.md) for the full fixed-point type reference.

### Arrays and Objects on the Heap

```typescript
let pos = { x: 0, y: 0, z: 0 };
pos.x += 10;

let history: number[] = [0, 0, 0, 0];
history[0] = player.health;
```

The compiler allocates these on the CON heap and generates the correct `flat[]` indexing.

### Record\<string, T\> Hash Maps

```typescript
let scores: Record<string, number> = {};
scores["player1"] = 500;
scores["player2"] = 300;
let s = scores["player1"];  // 500
```

Backed by a built-in FNV-1a hash table on the CON heap. String-literal keys are hashed at compile time — zero runtime cost.

### JSON.parse / JSON.stringify

```typescript
let doc: CJson = JSON.parse(rawText);   // parse from a CFile.Read string
let out: string = JSON.stringify(doc);  // serialise back
```

Useful for loading configuration files at runtime via `CFile`.

### Per-Actor Custom Properties

Declare non-native instance properties on `CActor`/`CPlayer` subclasses. The compiler allocates a per-actor heap block and generates `EVENT_SPAWN`/`EVENT_KILLIT` hooks automatically:

```typescript
interface EnemyState { phase: number; timer: number; }

class CustomEnemy extends CActor {
    constructor() {
        super(1234, true, 100);
        this.hp    = 100;
        this.state = { phase: 0, timer: 0 };
        this.label = 'Grunt';
    }

    public hp:        number = 100;
    public state:     EnemyState;
    public inventory: number[];
    public label:     string;

    Main() {
        this.hp        -= 1;
        this.state.phase = 1;
        this.label       = 'Damaged';
    }
}
```

### gameVar

Declare a native EDuke32 gamevar accessible from the in-game console:

```typescript
const TCDEBUG_MODE: gameVar = 0;  // gamevar TCDEBUG_MODE 0 REG_FLAGS
```

Override the initial value at build time:
```bash
tcc make --vars TCDEBUG_MODE=1
```

### TCUI — Immediate-Mode HUDs

```typescript
import './include/TCSet100/TCUI';

const ui = new TCUI();

class MyHUD extends CEvent {
    constructor() { super('DisplayEnd'); }
    Append() {
        ui.beginContainer(0, 0, 200, 50);
        ui.setLayout(0, 0, 200, 10, 0);
        ui.setFont(2930, 0, 8, 0, 0, ETextFlags.INTERNALSPACE);
        ui.text("HP: " + player.health);
        ui.endContainer();
    }
}
```

Zero heap allocation per frame — all layout state lives inside the `TCUI` object.

### TCDebug — Runtime Overlay

```typescript
import './include/TCSet100/TCDebug';
// Toggle from the EDuke32 console: setvar TCDEBUG_MODE 1
// Or bake in:  tcc make --vars TCDEBUG_MODE=1
```

Renders a live stack/heap usage overlay by self-hooking `EVENT_DISPLAYEND`.

### CFile — File I/O

`CFile` reads and writes files at runtime using the CON `rstack` mechanism. See `examples/tests/json/test_file_json.ts` for a complete `CFile.Read → JSON.parse` pipeline example.

---

## Build Workflow

TypeCON uses a two-stage pipeline: compile each TypeScript source to a `.tco` intermediate file, then link the objects into a single `.con`.

1. **Compile** to intermediate `.tco` files:
   ```bash
   tcc -c -il src/MyActor.ts src/MyEvent.ts
   ```

2. **Link** to a final `.con`:
   ```bash
   tcc -L -di -o EDUKE.CON
   ```

3. **Drop** `compiled/EDUKE.CON` into your EDuke32 mod folder.

```
project/
├── src/
│   ├── MyActor.ts
│   └── MyEvent.ts
├── obj/
│   ├── MyActor.tco     ← compiler output
│   └── MyEvent.tco
└── compiled/
    └── EDUKE.CON       ← linker output → goes into your mod folder
```

For most projects, `tcc make` runs all three steps automatically.

---

## tcc make — Project Build System

`tcc make` replaces manual flag chaining with a single project-level command. Create a `typecon.json` once and run the full pipeline with `tcc make`.

```bash
tcc make create    # interactive wizard — generates typecon.json
tcc make           # full pipeline: compile → link → validate
tcc make test      # run all test files listed in typecon.json
```

| Command | Description |
|---|---|
| `tcc make` | Full pipeline: compile → link → validate |
| `tcc make create` | Interactive wizard — generates `typecon.json` |
| `tcc make config` | Reconfigure an existing `typecon.json` |
| `tcc make compile` | Compile sources → `.tco` objects |
| `tcc make link` | Link `.tco` objects → `.con` |
| `tcc make validate` | Run the CON validator on the linked output |
| `tcc make test` | Run all test files listed in `typecon.json:tests` |

### typecon.json

```json
{
  "name": "MyMod",
  "sources": ["src/actors/**/*.ts", "src/events/**/*.ts"],
  "objDir": "obj",
  "outputDir": "compiled",
  "output": "EDUKE.CON",
  "stackSize": 1024,
  "heapPageSize": 4,
  "heapPageNumber": 128,
  "defaultInclusion": false,
  "precompiledModules": true,
  "validate": {
    "enabled": true,
    "warnNearLimits": true
  },
  "vars": { "TCDEBUG_MODE": 0 },
  "tests": [
    "tests/my_suite.test.json"
  ]
}
```

---

## CON VM Simulator & Validator

### Simulator

TypeCON includes a built-in CON interpreter that runs compiled `.con` output without launching EDuke32. It is the backbone of the automated test system.

```bash
tcc -c -il examples/tests/math/test_math.ts && tcc -L -di
tcc -S compiled/EDUKE.CON --test
# [PASS] TestMath::Append   4/4
```

Mark any `CEvent.Append()`, defstate, or `CActor.Main()` with `// debug-test` to enable `checkEq`/`checkFpEq` pass/fail tracking inside the simulator.

### Validator

The CON validator performs static analysis on the linked `.con` file before it reaches EDuke32. It checks that all `state` calls refer to declared defstates, struct field accesses use valid field names, event names are recognised, and warns when the output is approaching EDuke32 resource limits (arrays, gamevars, string table). Run it manually with `tcc make validate`, or it runs automatically as part of `tcc make`.

---

## Examples in This Repo

| Path | Description |
|---|---|
| `examples/actors/AssaultTrooper.ts` | Complete Duke3D enemy: AI states, dodge, hide, shoot, jetpack |
| `examples/actors/BattleLord.ts` | Boss enemy example |
| `examples/tests/general/test_for.ts` | `for` and `for-of` loop tests |
| `examples/tests/math/test_math.ts` | `Math` object tests — trig, rounding, `checkEq`/`checkFpEq` |
| `examples/tests/events/test_events.ts` | One of each event category |
| `examples/tests/json/test_file_json.ts` | `CFile.Read` → `JSON.parse` pipeline test |

Compile and run any example to verify your setup:

```bash
tcc -c -il examples/actors/AssaultTrooper.ts && tcc -L -di
tcc -S compiled/EDUKE.CON --test
```

---

## Limitations

- Generated CON code is unoptimized. Complex mods with many actors and states will work but produce larger output than hand-written CON.
- `CActor` and `CPlayer` constructors may only contain `super()` and property initialization. No `if`, loops, or function calls inside the constructor body.
- Local variables are strictly block-scoped; JavaScript-style hoisting does not apply.
- This is BETA software — breaking changes between minor versions are possible.

---

## License

Licensed under [GPL-3.0](https://github.com/MarcosPCB/TypeCon/blob/main/LICENSE).  
Source and issues: [github.com/MarcosPCB/TypeCon](https://github.com/MarcosPCB/TypeCon)  
Documentation: [marcospcb.github.io/TypeCon](https://marcospcb.github.io/TypeCon)
