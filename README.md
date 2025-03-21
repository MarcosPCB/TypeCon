# TypeScript to Build Engine CON Compiler

*This is a very early-stage development tool.*

Welcome to the TypeScript to Build Engine CON Compiler! This tool leverages the power of TypeScript to simplify the process of creating or modifying Duke Nukem 3D mods and developing games with the Build Engine. By writing TypeScript code, you can produce CON files that adhere to the Build Engine's scripting language requirements.

---

## Features

- **TypeScript Support**: Write scripts in TypeScript and transpile them into CON code.
- **User-Friendly CLI**: Pass parameters to customize the transpilation process.
- **Improved Modding Workflow**: Reduce errors and enjoy the structure of modern programming paradigms while working with the Build Engine.

---

## Usage

The compiler is a command-line tool with customizable parameters:

### Banner

```
TypeCON Compiler BETA Version 0.01 
By ItsMarcos - Use '-help' to get the list of commands 
```

#### Currently Available Commands
- **`yarn run dev`**: Transpile the current test data.
- **`yarn run debug`**: Properly debug the compiler.

### Parameters

Usage:

- **`-c`**: For the file path to be compiled.
- **`-cl`**: For a list of files to be compiled.
- **`-o`**: For the output file name.
- **`-of`**: For the output folder path.
- **`-ld`**: To write the TS lines inside the CON code.
- **`-ss`**: To define the stack size.
- **`-hl`**: Don't insert the header code (init code and states) inside the output CON.
- **`-h`**: Create the header file.
- **`-l`**: Create the header and the init files with the following list of CON files (separated by "").
- **`-1f`**: Compiles all files into one (must be used with -o)
- **`-di`**: Default inclusion (GAME.CON).
- **`-ei`**: Init file is EDUKE.CON.

---

## Limitations

To ensure compatibility with the Build Engine's scripting capabilities, the following limitations apply:

- **Code Optimization**: Currently, the generated CON code is not optimized and should be used very carefully.
1. **Constructor Restrictions**:

   - Function calls (other than `super()`) are not allowed within `constructor()` methods.
   - `if` statements are prohibited in `constructor()` methods.

2. **Block-Scoped Variables**:

   - Local variables are limited to their current block's scope. Variables declared in one block cannot be accessed from another.

---

## Contributing

Contributions are welcome! If you encounter bugs or have suggestions for improvements, please open an issue or submit a pull request.

---

## License

This project is licensed under the GNU General Public License v3. See the LICENSE file for details.

---

## Acknowledgments

Thank you for using this tool to enhance the Build Engine modding experience. We hope it saves you time and effort while bringing your creative ideas to life!

