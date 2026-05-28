# Virtual Machine Framework Skill

The file `src/modules/compiler/framework.ts` defines the CON initialization string. It is essentially a handwritten Virtual Machine operating inside the Build Engine's CON scripting language.

## Virtual Machine Architecture

### Registers

All registers are declared as `gamevar` with flag `132096` (defined as `REG_FLAGS`).

| Register | Name | Purpose |
|---|---|---|
| `r0`–`r23` | General Purpose | Primarily used for passing function parameters |
| `ra` | Accumulator | Holds the result of the last expression/operation |
| `rb` | Base / Return | Used for function return values and base addresses |
| `rc` | Counter | Used in loops and internal iteration |
| `rd` | Data | Temporary data holder for binary expression operands |
| `ri` | Index | **Used for all array/flat[] indexing** — set before every native struct access and property read/write |
| `rsi` | Source Index | Native struct dispatch and sub-function indexing |
| `rsw` / `rswc` / `rswe` | Switch Control | Condition holder, counter, and clause enabler for the two-pass switch trick |
| `rf` | Flags | State flags (e.g. bit 0 = heap address return mode) |
| `rbp` | Base Pointer | Points to the start of the current function's stack frame |
| `rsp` | Stack Pointer | Points to the top of the stack in the `flat` array |
| `rbbp` | Stored Base Ptr | Saved base pointer used during string frame management |
| `rsbp` | String Base | Base pointer for the quote string stack |
| `rssp` | String Stack | Current top pointer for the quote string stack |

`ri` is the most frequently touched register — every `visitMemberExpression` call either reads it (for `this` context) or writes it (`set ri <index>`) before emitting a `get/set<op>[ri].<field>` instruction.

### Flat Memory
- The entire memory (stack, globals, heap) is simulated inside a single massive array named `flat`.
- **Stack**: Indices `0` to `stackSize - 1`.
- **Globals**: Indices `stackSize` upwards.
- **Heap**: Everything after globals. Managed via `allocTable` which tracks pages.

### Garbage Collection (`_GC`)
- Implements a non-intrusive Mark-and-Sweep algorithm.
- Checks `allocTable` and scans the stack (from `rbp` to `rsp`) for live references.

### Strings
- **Logic Strings**: Stored in the `flat` array heap as ASCII integers.
- **Quote Strings**: Stored in the engine's quote memory (indices 0-1023) strictly for display commands. `_convertString2Quote` bridges the two.

## Agent Guidelines
- Modifying `framework.ts` is highly dangerous as it affects every single compiled project.
- If you add a new register, it must be declared here as a `gamevar` with flag `132096`.
- Understand that TypeCON doesn't use native CON variables for state; it uses `flat[]` index manipulation.
