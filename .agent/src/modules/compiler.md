# Compiler Module Skill

The `src/modules/compiler` directory contains the core transpiler logic for converting TypeScript AST (using `ts-morph`) into raw CON instructions or `.tco` intermediate objects.

## Core Components

### `TsToConCompiler.ts`
- The main driver for compilation.
- Takes a TypeScript project, initializes the AST, and traverses it via `visitStatement()`.

### `CompilerContext.ts`
- The most important state-holding object in the compilation process. It is passed by reference throughout the visit sequence.
- Tracks the symbol table (`Map<string, SymbolDefinition>`).
- Tracks current stack frame offsets (`localVarOffset`).
- Tracks global allocations (`globalAllocations`) which will be resolved by the linker later.

### `services/visitX.ts`
- Modular functions handling specific AST nodes.
- E.g., `visitClassDeclaration.ts` handles Duke3D actor definitions.
- E.g., `visitCallExpression.ts` converts standard function calls into `defstate` jumps or resolves native CON functions using the `nativeFunctions` registry.

## Memory Model Emulation
- Variables are assigned offsets.
- Local variables are pushed/popped from a simulated stack using `rsp` and `rbp` registers.
- Member accesses (`object.property`) are compiled into index offsets inside the global `flat` array.

## Agent Guidelines
- When modifying compilation behavior, find the corresponding `visitX.ts` file for that TypeScript construct.
- Never directly manipulate strings for memory allocation; always use `CompilerContext` methods to allocate global/local variables so they get correct `flat` array offsets.
