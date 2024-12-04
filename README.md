# TypeScript to Build Engine CON Transpiler

*This is a very early-stage development tool.*

Welcome to the TypeScript to Build Engine CON Transpiler! This tool leverages the power of TypeScript to simplify the process of creating or modifying Duke Nukem 3D mods and developing games with the Build Engine. By writing TypeScript code, you can produce CON files that adhere to the Build Engine's scripting language requirements.

---

## Features

- **TypeScript Support**: Write scripts in TypeScript and transpile them into CON code.
- **User-Friendly CLI**: Pass parameters to customize the transpilation process.
- **Improved Modding Workflow**: Reduce errors and enjoy the structure of modern programming paradigms while working with the Build Engine.

---


## Usage

The transpiler is a command-line tool with customizable parameters:

#### Currently Available Commands
- **`yarn run dev`**: Transpile the current test data.
- **`yarn run parse`**: Parse the test data.
- **`yarn run debug`**: Properly debug the code.

### Parameters

- **`-c`**: Specify the TypeScript file to transpile (required).
- **`-p`**: Parse the file without transpiling.
- **`-ld`**: Display detailed information about the lines of code.
- **`-ss`**: Set the stack size (default: `1024`).

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

