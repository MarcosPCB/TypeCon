# TypeCON Technical Architecture

This document explains the inner workings of the TypeCON compiler, how it manages memory, handles variables, and transpiles modern TypeScript constructs into the Build Engine's CON language.

---

## 1. Registers
TypeCON implements a virtual register machine on top of CON. These are defined as `gamevar` (global variables with flag `132096` to allow per-player/actor context where needed, though mainly used as globals for parameters).

| Register | Name | Purpose |
| :--- | :--- | :--- |
| `r0` - `r23` | General Purpose | Used primarily for passing function parameters. |
| `ra` | Accumulator | Holds the result of the last expression/operation. |
| `rb` | Base / Return | Used for function return values and base addresses. |
| `rc` | Counter | Used in loops and internal iteration. |
| `rd` | Data | Temporary data holder for operations. |
| `ri` | Index | Used specifically for array/memory indexing in the `flat` array. |
| `rsi` | Source Index | Special identifier for dispatching Subfunctions and indexing native arrays. |
| `rsw`, `rswc`, `rswe` | Switch Control | Condition holder, counter, and clause enabler for switches. |
| `rf` | Flags | Stores state flags (e.g., bit 0 for heap address return). |
| `rbp` | Base Pointer | Points to the start of the current function's stack frame. |
| `rsp` | Stack Pointer | Points to the top of the stack in the `flat` memory. |
| `rsbp` | String Base | Base pointer for the string (quote) stack. |
| `rssp` | String Stack | Current top pointer for the string (quote) stack. |

---

## 2. Flat Memory Model
TypeCON uses a single large array named `flat` to represent the entire accessible memory space. This mimics a real flat memory architecture.

### Address Space Layout:
1.  **Stack (Address `0` to `stackSize - 1`)**: Stores local variables, saved registers, and call frames.
2.  **Global Space (`stackSize` to `stackSize + globalSize - 1`)**: Reserved for global variables.
3.  **Heap (`stackSize + globalSize` and above)**: Dynamically allocated memory for objects and arrays.

The register `rds` (Segmentation) is initialized to point to the start of the heap.

### Heap Management
The compiler includes built-in `defstate` handlers for memory allocation:
- **`alloc`**: Takes size in `r0`, returns address in `rb`. It searches the `allocTable` for contiguous free pages.
- **`PAGE_SIZE` Logic**: Every allocation is rounded up to the nearest `PAGE_SIZE` (default 4 or 8). This reduces fragmentation and simplifies tracking.
- **Dynamic Growth**: If the heap is full, the framework calls `resizearray flat` to physically grow the memory available to the engine.
- **`free`**: Releases memory at address in `r0` by marking the corresponding index in `allocTable` as `0`.

---

## 3. String Management
TypeCON employs two parallel systems for handling strings: **Flat Strings** for logic/storage and **Quote Strings** for engine display.

### Flat Strings (Heap-Allocated)
Most TypeCON strings exist as regular objects within the `flat` memory array. They are heap-allocated during initialization or at runtime.

- **Storage Structure**:
  - `flat[ptr]`: Stores the **Length** of the string.
  - `flat[ptr + 1]` to `flat[ptr + length]`: Stores the actual characters as numeric ASCII codes.
- **Operations**: States like `_stringConcat` and `_convertInt2String` operate directly on these buffers.
- **Type Identifier**: In `allocTable`, strings are marked with type `2`.

### Quote Strings (The Engine Stack)
The Build Engine displays text via global "quotes" (indices 0-1023). TypeCON manages a subset of these as a stack to provide local scoping for display commands like `qputs` and `rotatesprite`.

- **Registers**: 
  - `rssp` tracks the current top quote index.
  - `rsbp` marks the bottom of the current string stack frame.
- **Conversion**:
  - When a display function (like `Native.printf`) is called, TypeCON automatically invokes `_convertString2Quote`. This state iterates through the **Flat String** buffer and copies its character values into the next available quote on the stack via logic using the `ASCII conversion table` (Quotes 900-994).
- **Temporary Buffer**: Quote `1023` is frequently used as a temporary scratchpad for formatting before a string is permanently pushed to the stack.

---

## 4. Garbage Collection
TypeCON implements a non-intrusive Mark-and-Sweep style Garbage Collector via the `_GC` state.

1.  **Scan**: It iterates through all active heap pages in `allocTable`.
2.  **Mark**: It scans the **entire stack** (from `rbp` up to `rsp`) looking for any value that matches the heap address.
3.  **Sweep**:
    - If a pointer is found on the stack, it's considered "alive". Any "toBeFreed" mark (bit `1024`) is cleared.
    - If a pointer is NOT found on the stack:
        - If it was already marked with bit `1024`, it is physically freed (`allocTable = 0`).
        - Otherwise, it is marked with bit `1024` to be checked in the next cycle.

---

## 5. Variable Storage
### Local Variables
Local variables are stored directly on the stack. When a variable is declared:
1.  `rsp` is incremented (`add rsp 1`).
2.  The value (usually in `ra`) is stored at `flat[rsp]`.
3.  The compiler's symbol table tracks the variable's offset relative to `rbp`.

### Global Variables
Globals are stored in the reserved global section of the `flat` array. In "Module Mode", they are accessed via unique identifiers like `_G_ADDR_varName` which the linker later resolves to absolute indices.

---

## 6. Functions and Call Frames
Functions are transpiled into CON `defstate` blocks. Every function call follows a strict "prologue" and "epilogue" to maintain the stack.

### Function Structure:
```con
defstate MyFunction
  set ra rbp      // Save old base pointer
  state push      // Push it to stack (flat[rsp])
  set rbp rsp     // Set new base pointer to current stack top
  add rbp 1       // Frame starts after the saved RBP

  // ... Function Body ...

  sub rbp 1       // Back to saved RBP location
  set rsp rbp     // Clean up local variables from stack
  state pop       // Restore old base pointer into ra
  set rbp ra      // Restore RBP
ends
```

---

## 7. Control Flow
### Switch Statements
Since CON doesn't natively support complex fallthrough switches, TypeCON uses a unique "Two-Pass" jump trick:

1.  **Pass 1**: It captures the current code address using `getcurraddress ra` and proceeds to calculate which case matches.
2.  **Jump**: It jumps back to the start of the block with a flag set.
3.  **Pass 2**: On the second execution, the logic uses the pre-calculated match to "enable" specific clauses (`rswe` register), allowing fallthrough until a `break` (which is transpiled to a `jump` out of the block).

### Subfunctions (Anonymous Functions)
Anonymous functions are indexed in a global dispatcher.
- `rsi` is loaded with the shared context or the function ID.
- `state _subFunctions_<hash>` handles the jump table.

---

## 8. Objects, Arrays, and Actor Labels
### Core Representation
Objects and Arrays are identical at the memory level: they are pointers to a block in the `flat` array.
- **Arrays**: `flat[ptr]` stores the length, followed by elements.
- **Objects**: `flat[ptr + offset]` stores properties.

### Actions, AIs, and Moves
These are special Build Engine types. TypeCON treats them as both native labels and structured objects:
1.  **CON Labels**: Commands like `action A_DOG_WALK 0 4 5 1 20` are generated.
2.  **Memory Objects**: If configured, the compiler also creates a "shadow" object in the `flat` memory at global scope.
    - **`IAction`**: Stores `loc` (the label pointer), `start`, `length`, `viewType`, `incValue`, and `delay`.
    - **`IMove`**: Stores `loc`, `horizontal_vel`, and `vertical_vel`.
    - **`IAi`**: Stores `loc`, `action` pointer, `move` pointer, and `flags`.

This dual representation allows you to pass an `Action` as a variable in TypeScript while still having it compile down to native engine labels when needed.

---

## 9. Language Sets & Native Integration
TypeCON uses "Language Sets" (e.g., `TCSet100`) to define the available native environment. This is primarily managed via `native.ts`.

### Command Translation
The compiler maps TypeScript function calls to native CON commands using the `nativeFunctions` array in `native.ts`.
- **String Mapping**: Simple commands like `native.fall()` map directly to the string `"fall "`.
- **Complex Logic**: Functions like `Spawn` or `Shoot` use TypeScript arrow functions to generate dynamic CON code based on arguments and optional function blocks (e.g., initializing an actor's properties immediately after spawning).
- **Flags**: `CON_NATIVE_FLAGS` (e.g., `LABEL`, `VARIABLE`, `ACTOR`) tell the compiler how to resolve each argument before generating the CON instruction.

### Native Objects & Properties

TypeCON exposes ten engine struct arrays as global read/write objects.
Each maps directly to a CON `get/set<op>[ri].<field>` pair, with `ri` holding the index
set by the preceding `visitExpression` call on the array index.

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

Member access like `projectiles[i].vel` compiles to `getprojectile[ri].vel ra`.
Assignment like `projectiles[i].vel = 512` compiles to `setprojectile[ri].vel ra`.

All ten names are excluded from symbol-table lookup in `visitMemberExpression.ts` (line 24)
so they bypass the local-variable path and fall directly into the CON accessor switch.

#### Sub-object groupings

Many structs expose both flat properties and logical sub-objects that alias the same CON field.
Sub-objects are a TypeScript-side convenience — they compile identically to the flat version:

```
projectiles[i].audio.fire   → getprojectile[ri].isound ra
projectiles[i].iSound       → getprojectile[ri].isound ra   (same)

input[i].motion.forward     → getinput[ri].fvel ra
input[i].forwardVel         → getinput[ri].fvel ra           (same)

sprites[i].hitType.ceilingZ → geta[ri].htceilingz ra
sprites[i].hitInfo.wall     → geta[ri].htg_t 6 ra
```

Sub-objects are entries with `type: CON_NATIVE_FLAGS.OBJECT` in a `nativeVars_*` array and
an `object: CON_NATIVE_VAR[]` child array in `src/sets/TCSet100/native.ts`.
`visitMemberExpression` recurses into this child array on nested property access.

#### Naming convention

- **`C` prefix** = Class (can be `extend`ed by user code): `CActor`, `CEvent`, `CPlayer`, `CSector`, `CWall`
- **`I` prefix** = Interface (struct shape only, used as a type annotation): `ISectorBase`, `IProjectile`, `ITSprite`, `IUserDef`, `ITileData`, `IPalData`, `IInput`

---

## 10. Pre-compiled Modules
TypeCON supports reusable modules that are written in TypeScript but compiled into standard CON states stored in an `asm` or `generated` folder.
- **Workflow**: Shared logic (like `_spriteFuncs.ts`) is transpiled into `.con` files containing `defstate` blocks.
- **Linker Integration**: These pre-compiled `.con` files are appended to the main output, allowing the final project to call them as standard states without re-compiling the logic every time.

---

## 11. CFile (File Operations)
The `CFile` class provides an interface for interacting with the file system, optimized for the Build Engine's `readarrayfromfile` and `writearraytofile` commands.

- **Mechanism**:
  - **Buffer**: Uses a temporary `number[]` buffer in the `flat` memory to hold file data.
  - **rstack Implementation**: When reading, it uses the engine's `rstack` (array) as an intermediate buffer. It calls `readarrayfromfile rstack <path>` and then copies/transposes the data into the `flat` heap.
  - **CONUnsafe Usage**: `CFile` methods heavily use `CONUnsafe()` to inject raw, high-performance CON instructions directly into the transpiled stream, bypassing the TypeScript expression parser.
- **Modes**: Supports both **Binary** (raw 32-bit values) and **Text** (ASCII/Unicode character conversion) modes.

---

## 12. The DN3D Module
The `DN3D` module brings native Duke Nukem 3D constants and structures into the TypeScript environment.
- **ENames**: A massive enumeration mapping classic tile/sprite names (like `DUKECAR`, `PIGCOP`, `EGG`) to their internal engine IDs.
- **Native Constants**: Defines standard game values like `shrunkDoneCount` or `thawTime` as `CON_CONSTANT` types, allowing the compiler to treat them as literals during transpilation.
- **Native States**: It includes declarations for native engine states that can be called from TypeScript while being linked to the original game logic.

---

## 13. Fixed-Point Arithmetic

TypeCON maps four fixed-point numeric types to plain TypeScript `number` intersections.
The compiler detects the declared type at the call site and automatically emits
`mulscale`/`divscale` instead of `mul`/`div` so precision is preserved.

### Precision types

| Type | Scale | 1.0 = | Typical use |
|---|---|---|---|
| `FP11` | Q20.11 | 2048 | BUILD engine BAM angles (0–2047 = full circle) |
| `FP14` | Q17.14 | 16384 | Engine sin/cos return values (−1.0 … 1.0) |
| `FP16` | Q15.16 | 65536 | General fixed-point math, zoom, coordinates |
| `FP30` | Q1.30 | 1073741824 | Unit-range values requiring high precision |

These are branded intersection types (`number & { __brand }`) — they are plain integers
at runtime; the brand is erased and exists only for compile-time type checking.

### Automatic code generation

The compiler reads the declared variable type via `FP_ALIAS_BITS` in
`visitVariableDeclaration.ts` and propagates `fpBits` through every sub-expression:

| TypeScript | CON output |
|---|---|
| `let a: FP16 = b * c` (both FP16) | `mulscale rd rd rhs 16` |
| `let a: FP16 = b / c` (both FP16) | `divscale rd rd rhs 16` |
| `let a: FP16 = b * c` (b=FP16, c=int) | `mul rd rhs` (scale preserved) |
| `let a: number = b * c` (both int) | `mul rd rhs` |

Mixing precisions (e.g. `FP16 * FP11`) raises a compile-time error.

### Conversion helpers

```typescript
intToFP16(x)        // shift left 16 bits
fp16ToInt(x)        // shift right 16 bits
fp16Raw(x)          // return raw integer (no shift — for APIs expecting 16.16 pattern)
fp16ToString(x)     // "1.5000" format via _convertFP2String defstate
fp16FromString(s)   // parse "1.5000" back to FP16
// Same pattern: FP11, FP14, FP30
```

### Manual override

Use `mulscale(a, b, shift)` and `divscale(a, b, shift)` for manual cross-precision math
when the automatic path is insufficient.
