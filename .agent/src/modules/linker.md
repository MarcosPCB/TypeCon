# Linker Module Skill

The `src/modules/linker` module takes intermediate `.tco` objects (compiled modules) and merges them into a final executable `.con` file for EDuke32.

## Core Responsibilities
- **Merging**: Combines multiple `.tco` JSON files into a single CON script.
- **Topological Sorting**: Ensures modules are linked in the correct dependency order.
- **Symbol Resolution**: Merges local symbol tables into one global table. Detects and throws errors on naming collisions.
- **Placeholder Patching**: Replaces `__PLACEHOLDER_ADDR__` tokens in the intermediate CON code with the absolute flat memory indices calculated during the linking phase.
- **Framework Injection**: Prepends the CON Virtual Machine (from `framework.ts`) at the top of the final output.

## Agent Guidelines
- If a user reports that a multi-file project fails to find a variable, check the linking process and symbol table merging.
- Linking does not parse TypeScript. It only works with the raw string output and JSON metadata produced by the compiler.
- If you need to change how the initial memory or registers are set up, do NOT do it here; that logic belongs in `framework.ts`.
