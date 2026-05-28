# Virtual Machine Framework Skill

The file `src/modules/compiler/framework.ts` defines the CON initialization string. It is essentially a handwritten Virtual Machine operating inside the Build Engine's CON scripting language.

## Virtual Machine Architecture

### Registers
- `r0` to `r23`: General purpose registers (mainly for function parameters).
- `ra`: Accumulator (holds expression results).
- `rb`: Base / Return value register.
- `rsp` / `rbp`: Stack Pointer and Base Pointer.
- `rssp` / `rsbp`: String Stack pointers (for quote memory).

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
