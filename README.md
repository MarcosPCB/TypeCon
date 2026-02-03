# TypeScript to Build Engine CON Compiler (TypeCON)

[View the documentation website](https://marcospcb.github.io/TypeCon) | [Technical Architecture](Architecture.md)

*This is a development tool in ALPHA stage.*

Welcome to the TypeCON Compiler! This tool leverages the power of TypeScript to simplify the process of creating or modifying Duke Nukem 3D mods and developing games with the Build Engine. By writing TypeScript code, you can produce CON files that adhere to the Build Engine's scripting language requirements.

---

## 🚀 Features

- **Modern TypeScript Support**: Use classes, interfaces, enums, and modern operators like **Spread (...)** for objects and arrays.
- **Virtual Machine**: Implements a virtual register machine, stack, and heap with a Mark-and-Sweep Garbage Collector.
- **Separate Compilation & Linking**: Compile individual files to `.tco` (Intermediate) format and link them later, or compile a whole project at once.
- **Hand-written CON Integration**: Use `CON()` and `CONUnsafe()` for direct engine instruction injection.
- **VS Code Development Support**: Includes a TypeScript plugin for real-time validation and Duke 3D type safety.

---

## 🛠 Usage

The compiler is a command-line tool (`tcc`) with a robust set of parameters for different workflows.

### Banner
```text
TypeCON Compiler ALPHA Version 0.7.0 
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

---

## 🧪 Examples

TypeCON comes with built-in templates to help you start:
- **`AssaultTrooper.ts`**: A complex Duke 3D enemy implementation using classes and AI states.
- **`test.ts`**: A general feature test showcasing object/array manipulation, native calls, and debugging.

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
