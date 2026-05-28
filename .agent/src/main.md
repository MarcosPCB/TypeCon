# CLI / Main Entrypoint Skill

This module (`src/main.ts`) serves as the Command-Line Interface (CLI) and primary entry point for the **TypeCON** compiler.

## Core Responsibilities
- Parses command-line arguments and flags.
- Orchestrates the build pipeline depending on the selected mode:
  - **Module Mode (`-c`)**: Compiles TypeScript files into `.tco` intermediate objects.
  - **Linker Mode (`-L`)**: Links `.tco` files into the final `.con` executable script.
  - **Single Pass Mode**: Legacy mode combining both (less used for large projects).

## Important CLI Arguments to Know
- `-i` / `-il`: Input file(s) path.
- `-o`: Output file name.
- `-of`: Output folder path.
- `-c`: Compile to intermediate `.tco` object.
- `-L`: Link `.tco` objects to final `.con`.
- `-di` / `--default-inclusion`: Include `GAME.CON` as a default inclusion.
- `-C` / `--clean`: Empty build folders (`obj/`, `asm/`, `compiled/`) and exit.
- `-hl` / `--headerless`: Omit the VM init header from the output (used when the header is provided separately).
- `-np` / `--no-precompiled`: Disable automatic linking of pre-compiled system modules (`_mathFuncs`, `_stringFuncs`, etc.).
- `-sep` / `--separate`: (Used with `-L`) Output each linked module as its own `.con` file instead of one merged file.

## Agent Guidelines
- When building a mod, the expected workflow is two-step: `tcc -c -i src/Actor.ts` followed by `tcc -L -di -o final.con`.
- Avoid adding heavy logic to `main.ts`; it is simply a delegator for the `Compiler` and `Linker` classes.
