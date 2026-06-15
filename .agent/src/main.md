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

## Simulator & Test Flags

| Flag | Description |
|---|---|
| `-S`, `--sim` | Run the CON VM simulator on the compiled output |
| `--state NAME` | Run a specific `defstate` instead of the full init sequence |
| `--actor PICNUM` | Run a specific actor (fires `EVENT_SPAWN` first) |
| `--event NAME` | Run a specific event handler |
| `--no-init` | Skip init events (useful for unit-testing single states in isolation) |
| `--mem` | Print per-phase stack HWM and page-based heap accounting |
| `--test` | Aggregate `checkEq`/`checkFpEq` results; exit `0` (all pass) or `1` (any fail) |
| `--2-pass-gc` | Run GC twice after entry point (converts "marked to free" into "reclaimed") |
| `--strict-int` | Throw on NaN or decimal values written to CON variables |
| `--report FILE` | Write JSON report: memory stats, test results, variables, `flatMemory` snapshot |
| `--set-field-actor [I]f=v` | Pre-seed an actor struct field before simulation |
| `--set-field-player [I]f=v` | Pre-seed a player struct field |
| `--set-field-sector [I]f=v` | Pre-seed a sector struct field |
| `--set-field-wall [I]f=v` | Pre-seed a wall struct field |
| `--vars NAME=VALUE` | Override a `gameVar` initial value at build/link time |

## Project Build (`tcc make`)

| Command | Description |
|---|---|
| `tcc make` | Full pipeline: compile → link → validate |
| `tcc make create` | Interactive wizard — generates `typecon.json` |
| `tcc make config` | Edit an existing `typecon.json` interactively |
| `tcc make compile` | Compile source files → `.tco` objects only |
| `tcc make link` | Link `.tco` objects → final `.con` only |
| `tcc make validate` | Validate the linked output with the CON validator |
| `tcc make test` | Run all test files listed in `typecon.json:tests` |
| `tcc make clear` | Empty `obj/`, `asm/`, and `compiled/` (no build) |

`tcc test <script.json>` runs a multi-scenario test harness (compile + link + simulate + assert) from a single JSON file without a `typecon.json`.

## Agent Guidelines
- When building a mod, the expected workflow is two-step: `tcc -c -i src/Actor.ts` followed by `tcc -L -di -o final.con`.
- Avoid adding heavy logic to `main.ts`; it is simply a delegator for the `Compiler` and `Linker` classes.
- The simulator (`-S`) runs compiled output without EDuke32; use `--test` for in-process unit testing and `--mem` to check for memory leaks.
