# TypeScript to Build Engine CON Compiler (TypeCON)

[View the documentation website](https://marcospcb.github.io/TypeCon) | [Technical Architecture](Architecture.md)

*This is a development tool in BETA stage.*

Welcome to the TypeCON Compiler! This tool leverages the power of TypeScript to simplify the process of creating or modifying Duke Nukem 3D mods and developing games with the Build Engine. By writing TypeScript code, you can produce CON files that adhere to the Build Engine's scripting language requirements.

---

## 🚀 Features

- **Modern TypeScript Support**: Use classes, interfaces, enums, and modern operators like **Spread (...)** for objects and arrays.
- **Virtual Machine**: Implements a virtual register machine, stack, and heap with a Mark-and-Sweep Garbage Collector.
- **Separate Compilation & Linking**: Compile individual files to `.tco` (Intermediate) format and link them later, or compile a whole project at once.
- **Fixed-Point Math (FP11 / FP14 / FP16 / FP30)**: First-class fixed-point types with automatic `mulscale`/`divscale` code generation.
- **Math & Anim Libraries**: Built-in `Math` and `Anim` global objects with trig, rounding, easing curves, interpolation, and more — all dispatched as CON `defstate` calls.
- **Full-Precision Sprite & Text Rendering**: `RotateSpriteF` and `ScreenTextF` accept normalized screen coordinates (FP16) and sub-degree angles (FP11), automatically setting `ROTATESPRITE_FULL16`.
- **Hand-written CON Integration**: Use `CON()` and `CONUnsafe()` for direct engine instruction injection.
- **VS Code Development Support**: Includes a TypeScript plugin for real-time validation and Duke 3D type safety.

---

## 🛠 Usage

The compiler is a command-line tool (`tcc`) with a robust set of parameters for different workflows.

### Banner
```text
TypeCON Compiler BETA Version 0.8.0
By ItsMarcos - Use '--help' or '-?' to get the list of commands
```

---

## 📦 Getting Started

1. **Install globally**:
   ```bash
   npm install -g typecon
   ```
2. **Setup your project**:
   In an empty directory, run:
   ```bash
   tcc setup
   ```
   This will:
   - Create your source folder (e.g., `src`).
   - Setup the `include` folder with native definitions.
   - Install `typescript` and `typecon_plugin`.
   - Create a `tsconfig.json` with plugin support.
   - (Optional) Configure VS Code to use the local TypeScript SDK for the plugin to work.

---

## 🔢 Fixed-Point Types

TypeCON supports four fixed-point precisions as first-class types. Arithmetic between FP values automatically emits `mulscale`/`divscale` instructions.

| Type   | Scale (1.0 =) | Typical use                        |
|--------|---------------|------------------------------------|
| `FP11` | 2048          | BUILD engine BAM angles (0–2047)   |
| `FP14` | 16384         | sin/cos return values (−1.0..1.0)  |
| `FP16` | 65536         | General sub-pixel / sub-unit math  |
| `FP30` | 1073741824    | High-precision unit-range values   |

```typescript
let angle: FP11 = 0.25;           // 512 raw — quarter turn
let s: FP14 = Math.sin(angle);    // FP11 in → FP14 out (CON sin instruction)
let x: FP16 = 0.5;                // 32768 raw — half-screen
```

### Conversion helpers

```typescript
intToFP16(n)   fp16ToInt(v)   fp16Raw(v)   fp16ToString(v)
intToFP11(n)   fp11ToInt(v)   fp11Raw(v)   fp11ToString(v)
intToFP14(n)   fp14ToInt(v)   fp14Raw(v)   fp14ToString(v)
intToFP30(n)   fp30ToInt(v)   fp30Raw(v)   fp30ToString(v)
```

---

## 📐 Math Object

`Math` is a global object dispatched via CON `defstate` calls.

```typescript
// Rounding
Math.floor(v: FP16): number
Math.ceil(v: FP16): number
Math.round(v: FP16): number
Math.abs(v: FP16): FP16
Math.clamp(v, min, max: FP16): FP16
Math.min(a, b: FP16): FP16
Math.max(a, b: FP16): FP16

// Trig — angle in FP11 (BAM), returns FP14
Math.sin(angle: FP11): FP14
Math.cos(angle: FP11): FP14
Math.tan(angle: FP11): FP14

// Other
Math.sqrt(v: FP16): FP16
Math.pow(base, exp: FP16): FP16
Math.log2(v: FP16): FP16
```

---

## 🎞 Anim Object

`Anim` provides animation and timing utilities — all FP16-based.

```typescript
Anim.lerp(a, b, t: FP16): FP16
Anim.smoothstep(t: FP16): FP16
Anim.smootherstep(t: FP16): FP16
Anim.easeInQuad(t: FP16): FP16
Anim.easeOutQuad(t: FP16): FP16
Anim.easeInOutQuad(t: FP16): FP16
Anim.easeInCubic(t: FP16): FP16
Anim.easeOutCubic(t: FP16): FP16
Anim.easeInQuint(t: FP16): FP16
Anim.easeOutQuint(t: FP16): FP16
Anim.easeInSine(t: FP16): FP16
Anim.easeOutSine(t: FP16): FP16
Anim.easeInOutSine(t: FP16): FP16
Anim.easeInPow(t: FP16, power: number): FP16
Anim.easeOutPow(t: FP16, power: number): FP16
Anim.bezierQuad(a, b, c, t: FP16): FP16
Anim.pingPong(t, period: number): number
Anim.oscillateFP(t, period: number): FP16
Anim.approach(curr, target, step: number): number
Anim.pulse(t, period, duty: number): number
```

---

## 🖼 Full-Precision Rendering

### `RotateSpriteF`

Normalized-coordinate variant of `rotatesprite`. Automatically sets `ROTATESPRITE_FULL16`.

```typescript
this.RotateSpriteF(
    x: FP16,          // normalized [0.0–1.0] → maps to 20 971 520 FULL16 units
    y: FP16,          // normalized [0.0–1.0] → maps to 13 107 200 FULL16 units
    scale: FP16,      // 1.0 = native size
    ang: FP11,        // 1.0 = full circle (2048 BAM)
    picnum, shade, pal, orientation, x0, y0, x1, y1
);
```

### `ScreenTextF`

Normalized-coordinate variant of `screentext`. Automatically sets `ROTATESPRITE_FULL16`.

```typescript
this.ScreenTextF(
    picnum,
    x: FP16,                // normalized [0.0–1.0]
    y: FP16,                // normalized [0.0–1.0]
    scale: FP16,
    block_ang: FP11,        // angle of the whole text block
    character_ang: FP11,    // angle of each character
    quote, shade, pal, orientation, alpha,
    xspace, yline, xbetween, ybetween, flags, x0, y0, x1, y1
);
```

---

## 🔗 Compile & Link Workflow

TypeCON works with two build stages: **compile** each TypeScript file independently into a `.tco` intermediate object, then **link** the objects together into a single `.con` file.

### Step 1 — Compile each file to `.tco`

```bash
tcc -c -il templates/AssaultTrooper.ts templates/BattleLord.ts
```

This produces `obj/AssaultTrooper.tco` and `obj/BattleLord.tco`.  
Each `.tco` file is a self-contained JSON bundle containing:
- The compiled CON code with `__PLACEHOLDER__` tokens for unresolved globals.
- A symbol table snapshot (actors, functions, enums, globals).
- A relocation table so the linker can patch addresses after merging.

### Step 2 — Link the objects into a final `.con`

```bash
tcc -L -di -o eduke.con
```

This produces `compiled/eduke.con` with:
- The VM framework header (registers, stack, heap, GC) prepended once.
- Default inclusion of GAME.CON file (-di flag)
- All `flat[]` global slots assigned and placeholders patched.
- Both actors' `defstate` and `useractor` blocks merged in topological order.

### Typical project layout after building

```
project/
├── src/
│   ├── AssaultTrooper.ts
│   └── BattleLord.ts
├── obj/
│   ├── AssaultTrooper.tco   ← compiler output
│   └── BattleLord.tco       ← compiler output
└── compiled/
    └── my_mod.con           ← linker output, drop into your EDuke32 mod folder
```

---

## 🔧 Make Module (Project Build System)

`tcc make` replaces manual flag chaining with a project-level build orchestrator. Create a `typecon.json` once and run the full pipeline — or any individual step — with a single command.

### Quick start

```bash
# 1. Generate typecon.json (interactive wizard)
tcc make create

# 2. Run the full pipeline (compile → link → validate)
tcc make

# 3. Reconfigure at any time
tcc make config
```

### Subcommands

| Command | Description |
|---|---|
| `tcc make` | Full pipeline: compile → link → validate |
| `tcc make create` | Interactive wizard — generates `typecon.json` |
| `tcc make config` | Reconfigure an existing `typecon.json` |
| `tcc make compile` | Compile source files → `.tco` objects |
| `tcc make link` | Link `.tco` objects → final `.con` |
| `tcc make validate` | Validate the linked output with the CON validator |
| `tcc make clear` | Empty `obj/`, `asm/`, and `compiled/` (no build) |

### `typecon.json` format

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
  "modules": [
    { "path": "src/actors/BossActor.ts", "enabled": true, "required": true },
    { "path": "src/actors/MinorEnemy.ts", "enabled": false }
  ],
  "validate": {
    "enabled": true,
    "warnNearLimits": true,
    "baseDirs": ["baseCON"]
  },
  "locked": ["stackSize", "heapPageSize"]
}
```

All fields are optional and fall back to the same defaults as the equivalent CLI flags.

### Module configuration

The `modules[]` array lets you enable or disable specific source files independent of what the `sources` globs match. Entries with `"required": true` cannot be disabled via `tcc make config`.

### Lock system

Any field key listed in `locked[]` is shown in `tcc make config` but cannot be edited — useful for locking down stack/heap sizes or output paths in shared project configs. Adding `"locked"` to its own array hides the lock management UI entirely.

---

## 🚥 CLI Parameters

### Project Setup
- **`setup`**: Interactive setup for folders, includes, and VS Code environment.

### Common Options
- **`-i, --input <file>`**: Input TypeScript file path.
- **`-il, --input-list <files...>`**: List of files for batch processing.
- **`-o, --output <file>`**: Name of the output file.
- **`-of, --output-folder <path>`**: Output directory (defaults to `compiled`).
- **`-aCm, --accept-con-modules`**: Allows the project to accept relocatable CON modules.

### Compiler-Specific Options
- **`-c, --compile`**: Compile to `.tco` (intermediate) format instead of final CON.
- **`-if, --input-folder <path>`**: Compiles all `.ts` files inside a directory.
- **`-m, --module`**: Enables module mode for single file compilation.
- **`-ic, --intermediate-code`**: Generates raw CON with markers into the `asm` folder.
- **`-sc, --share-context`**: Shares the symbol table context between modules during compilation.
- **`-dl, --detail-lines`**: (alias `-lp`) Includes original TS lines as comments in the output.
- **`-sp, --symbol-print`**: Prints the internal symbol table for debugging.

### Linker & Framework Options
- **`-L, --linker`**: Links multiple `.tco` files into a final `.con`.
- **`-sep, --separate`**: (Used with `-L`) Outputs linked modules as separate files.
- **`-Cm, --con-module`**: Outputs a relocatable CON module with global array storage.
- **`-ss, --stack-size <num>`**: Define virtual stack size (Default: 1024). Recommended > 1024.
- **`-hs, --heap-size <num>`**: Define virtual heap size.
- **`-ps, --page-size <num>`**: Heap page minimum size (Default: 4).
- **`-pn, --page-number <num>`**: Number of heap pages (Default: 128).
- **`-hl, --headerless`**: Excludes the framework initialization/states from the output.
- **`-h, --header`**: Generates a separate `header.con` file.
- **`-ci, --create-init`**: Generates an `init.con` linking all provided files.
- **`-np, --no-precompiled`**: Disables automatic linking of pre-compiled system modules.
- **`-di, --default-inclusion`**: Includes `GAME.CON` at the top of the output.
- **`-ei, --eduke-init`**: Sets the initialization filename to `EDUKE.CON`.
- **`-C, --clean`**: Empty the `obj`, `asm`, and `compiled` folders.

---

## 🧪 Templates & Test Files

TypeCON ships with several templates under `templates/`:

| File | Description |
|---|---|
| `AssaultTrooper.ts` | Full Duke 3D enemy implementation using `CActor`, AI states, and actions. |
| `BattleLord.ts` | Another actor example — the Battlelord boss. |
| `test.ts` | General feature test: objects, arrays, native calls, debugging helpers. |
| `test_fp.ts` | Fixed-point arithmetic test suite — FP16 lerp, `RotateSprite`, viewport math. |
| `test_math.ts` | `Math` object dispatch tests — trig, rounding, FP conversions, `checkEq`/`checkFpEq`. |
| `test_anim.ts` | `Anim` object dispatch tests — easing, interpolation, ping-pong, oscillation. |

Compile any template to verify your setup:
```bash
tcc -c -i templates/test_math.ts
tcc -c -i templates/test_anim.ts
tcc -c -i templates/test_fp.ts
```

---

## 📜 Documentation & Architecture

For a deep dive into how TypeCON handles memory, strings, and garbage collection, please refer to the **[Technical Architecture](Architecture.md)** document.

### Core Modules:
- **DN3D Module**: Maps classic labels (`PIGCOP`, `DUKECAR`) to TypeScript enums.
- **CFile Class**: High-performance file I/O using the CON `rstack`.
- **String System**: Dual-mode handling (Flat memory for logic, Quote stack for display).

---

## ⚠️ Limitations

- **Optimization**: Generated code is currently unoptimized. Use large scripts with care.
- **Constructor Rules**: No function calls (except `super()`) or control flow inside constructors.
- **Scoped Locals**: Local variables are strictly block-scoped.

---

## 🤝 Contributing & License

Contributions are welcome! Open an issue or submit a pull request on [GitHub](https://github.com/MarcosPCB/TypeCon).

Licensed under **GPL-3.0**.
