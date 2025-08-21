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
TypeCON Compiler BETA Version 0.5.0 
By ItsMarcos - Use '--help or -?' to get the list of commands 
```

#### Currently Available Commands

- **`yarn tcc`**: CLI - use --help or -? to check out the options available

### Parameters

Usage:
**First time Setup**

- **`setup`**: Creates the project's basic setup including folders, include files, templates and the basic TypeScript configuration

**Compile options**

- **`--input or -i`**: For the file path to be compiled.
- **`--input_list or -il`**: For a list of files to be compiled.
- **`--output or -o`**: For the output file name.
- **`--output_folder or -of`**: For the output folder path.
- **`--detail_lines or -dl`**: To write the TS lines inside the CON code.
- **`--stack_size or -ss`**: To define the stack size.
- **`--headerless or -hl`**: Don't insert the header code (init code and states) inside the output CON.
- **`--header or -h`**: Create the header file.
- **`--link or -l`**: Create the header and the init files with the following list of CON files (separated by "").
- **`--one_file or -1f`**: Compiles all files into one (must be used with -o)
- **`--default_inclusion or -di`**: Default inclusion (GAME.CON).
- **`-eduke_init or -ei`**: Init file is EDUKE.CON.

---

## Examples

To help you get started with the TypeCON compiler, we have provided a couple of example files in the `test/data` directory. These examples showcase the capabilities of the compiler and provide a good starting point for your own projects.

### `AssaultTrooper.ts`

This file is a complete implementation of an enemy from Duke Nukem 3D, the Assault Trooper. It showcases how to create a complex actor with multiple states and behaviors using an object-oriented approach with TypeScript.

Key features demonstrated:

* **Actor Definition:** The `AssaultTrooper` class extends a base `CActor` class, providing a clear structure for defining the enemy's properties and methods.
* **State Management:** The file defines a comprehensive set of actions, moves, and AI configurations for the actor, such as `aStand`, `aWalking`, `aShoot`, `aiSeekPlayer`, `aiDucking`, etc.
* **Behavioral Logic:** The class methods (`Hide`, `GonnaShoot`, `Seek`, `Duck`, `Shooting`, `Flee`, `Dying`, `Jetpack`, `Suffering`, `Shrunk`) implement the actor's behavior in different situations.
* **Event Handling:** The `Main` method acts as the central loop for the actor, handling events and transitions between different states.
* **Actor Variations:** The `Variations` property demonstrates how to create different versions of the same actor with unique behaviors (e.g., `OnJetpack`, `OnDuck`, `OnShoot`).

### `test.ts`

This file serves as a test case for various features of the TypeCON compiler, demonstrating its capabilities in handling modern programming concepts and translating them into the Build Engine's scripting language.

Key features demonstrated:

* **Custom Types:** It defines custom data structures (`wow`, `test`) to showcase the compiler's ability to work with complex types.
* **Object-Oriented Programming:** It defines a class `displayRest` that extends a base `CEvent` class, demonstrating the use of inheritance and methods with their unique capabilities (events).
* **Object and Array Manipulation:** The code creates and manipulates objects and arrays, including nested objects and dynamic arrays (`push`).
* **Event System:** It shows how to create custom event handlers that can be triggered by the game engine.
* **Native Interoperability:** The file demonstrates how to call native game functions (`RotateSprite`, `PrintValue`) and access game state variables (`sectors`).
* **Debugging:** It includes calls to debugging functions like `PrintValue` and `PrintStackAndBreak`, which are essential for troubleshooting scripts.

---

## The `include` Folder

Upon building the project, a new folder called `include` will be created. This folder contains the TypeCON sets that provide you with the necessary classes, methods, functions, constants, and variable declarations to start coding.

Currently, the available TypeCON set is **TCSet100**, which includes:

*   **DN3D Module:** This module provides access to Duke Nukem 3D's own code. To use this module, you must include the default `GAME.CON`, `USER.CON`, and `DEFS.CON` files in your project.
*   **CFile Class:** A utility class that allows you to read and write files from within your CON scripts.
*   **`native.ts`:** This file contains the definitions for native functions, structures, and variables, along with their corresponding CON generated code.
*   **`types.ts`:** This file contains the basic classes, variables, methods, functions, and constants that are fundamental to the Eduke32 CON VM.

**Important:** To work with TypeCON, you must at least import the `types.ts` file in your project. This is the minimum requirement to get access to the basic types and functionalities.

All the classes, methods, and functions in the TypeCON sets are fully documented with JSDoc comments to help you understand their purpose and usage.

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
