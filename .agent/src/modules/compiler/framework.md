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
| `rd` | Data | Left-operand scratch for binary expressions; also pointer offset accumulator |
| `ri` | Index | **Used for all array/flat[] indexing** — set before every native struct access and property read/write |
| `rsi` | Source Index | Native struct dispatch and sub-function indexing |
| `rsw` / `rswc` / `rswe` | Switch Control | Condition holder, counter, and clause enabler for the two-pass switch trick |
| `rf` | Flags | Bit-field of runtime state (bit 0 = heap address return, bit 16 = string address, etc.) |
| `rds` | Segmentation | Initialized to `stackSize`; marks the start of the heap region in `flat[]` |
| `rbp` | Base Pointer | Frame base pointer — set to `rsp + 1` at every function and method entry |
| `rsp` | Stack Pointer | Top of the `flat[]` stack; initialized to `globalStaticSize - 1`; grows upward on push |
| `rbbp` | Saved Block Base | Snapshot of `rbp` taken at the start of actor `Main()` and event `Append()`/`Prepend()` prologues **only** (not regular defstates). Used by `return`/`break` epilogues to restore `rbp` to the outermost frame for clean stack unwind, regardless of how many nested `state` calls are on the stack |
| `rsbp` | String Base | Base pointer for the quote-string stack (initialized to 1024) |
| `rssp` | String Stack | Top of the quote-string stack (initialized to 1023) |
| `rfx0`–`rfx3` | FP Sub-Expr Scratch | Spill slots for `rd` during nested binary expression compilation. When `visitBinaryExpression` needs to evaluate a sub-expression while `rd` already holds an outer left operand, it saves `rd` to `rfx{context.rfxAllocated}` (incrementing the counter 0→4); falls back to `state pushd` when all 4 are occupied. Also used by precompiled defstates such as `_convertFP2String` |
| `_testCounter` | Test Counter | Initialized to `-1` (disabled). Set to `0` by `_testInit` when `// debug-test` mode is active. Encodes `(total_count << 12) | pass_count`; decoded after simulation by `--test` |
| `_pCptr` | Per-Actor Property Pointer | `GAMEVAR_PERACTOR` (flag `2`) — every sprite has its own slot. Holds the `flat[]` heap address of that actor's custom property block, or `0` if none |

`ri` is the most frequently touched register — every `visitMemberExpression` call either reads it (for `this` context) or writes it (`set ri <index>`) before emitting a `get/set<op>[ri].<field>` instruction.

`rbbp` vs `rbp`: `rbp` is the active frame base and changes with every nested `state` call. `rbbp` is a snapshot of the outermost block's `rbp`, set once per actor/event entry. When TypeCON's `break` exits an actor block or `return` is used inside `Main()`/`Append()`, the epilogue does `set rbp rbbp; sub rbp 1; set rsp rbp` to unwind the entire call stack back to the outermost frame before the CON `break` or `terminate`.

### Flat Memory
The entire memory (stack, globals, heap) lives in a single `flat[]` array. Initial size is `stackSize`; the heap grows it dynamically via `resizearray flat`.

- **Globals**: Assigned by the linker starting from index `0`. Linker patches `_G_ADDR_NAME` placeholders with the numeric offset.
- **Stack**: `rsp` starts at `globalStaticSize - 1 = stackSize + globalSize - 1`; frames grow upward (`add rsp 1`).
- **Heap**: Starts at `flat[rds] = flat[stackSize]`. Managed via `allocTable` / `blockPages` page tables.

### Heap Allocator
- `allocTable[heapNumPages]`: `0` = free page; else = allocation type for the first page of a block. Bit `1024` = GC mark flag.
- `blockPages[heapNumPages]`: for the first page of a live block, the number of pages it spans; `0` = free.
- `_GetFreePages` defstate: first-fit scan with O(1) block-skip via `blockPages`.
- **In-place realloc fast path**: if the block being reallocated is the last allocated block (at heap end), `heaptables` is extended directly — no copy needed. Prevents O(N²) cost during incremental string growth.
- Page types: `1`=array, `2`=string, `4`=object, `16`=peractor (per-actor property block).
- Heap grows by calling `resizearray flat heapsize` when a bump-alloc is needed.

### Garbage Collection (`_GC`)
Non-intrusive two-cycle Mark-and-Sweep:
1. **Stack scan**: iterates `flat[rbp..rsp]` looking for values that match a live heap address.
2. **Per-actor scan**: `for rc allsprites { getactorvar[rc]._pCptr ra }` keeps per-actor property blocks alive even when not on the stack.
3. **Sweep**: pages not reachable from stack or `_pCptr` are first marked with bit `1024`; if they are still unreachable in the next cycle they are freed.
`EVENT_KILLIT` in the framework frees `_pCptr` automatically when any actor is killed.

### Strings
- **Heap Strings**: `flat[ptr]` = length, `flat[ptr+1..ptr+length]` = ASCII codes. Used for logic, concatenation, JSON.
- **Quote Strings**: Engine quote indices 0–1023; strictly for display commands (`qputs`, `rotatesprite` text). `_convertString2Quote` copies from heap string to quote stack via the ASCII table (quotes 900–994).
- String stack registers `rsbp`/`rssp` track the current quote frame (initialized to 1024/1023).

## Agent Guidelines
- Modifying `framework.ts` is highly dangerous as it affects every single compiled project.
- If you add a new register, it must be declared here as a `gamevar` with flag `132096`.
- Understand that TypeCON doesn't use native CON variables for state; it uses `flat[]` index manipulation.
