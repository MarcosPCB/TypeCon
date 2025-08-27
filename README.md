# TypeScript to Build Engine CON Compiler

[View the documentation website](https://marcospcb.github.io/TypeCon)

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
TypeCON Compiler BETA Version 0.6.0 
By ItsMarcos - Use '--help or -?' to get the list of commands 
```

---

## Getting Started

The easiest way to get started with TypeCON is to install it globally using `npm install -g typecon`. This will allow you to use the `tcc` command to compile your CON code from anywhere.

If you don't want to install it globally, you can still install it locally using a package manager like `yarn`. To do this, add TypeCON as a dependency to your project using `yarn add typecon`. Then, you can use the `tcc` command to compile your CON code by running `yarn tcc`.

After installation, you can use the `tcc` command to generate the base files for your project. To do this, run `yarn tcc setup` in your project directory. This will create the necessary files and directories to get you started.

Alternatively, if you're using NPM, you can install TypeCON using `npm install typecon`. After installation, you can use the same `tcc` command to set up your project.

Once you've installed TypeCON and set up your project, you can start using it to write CON code in a more modern, object-oriented syntax. The `include` folder will contain the necessary type definitions and classes to get you started. Just import the `types.ts` file and start writing your code!

**Important Note:** To work with TypeCON, you need to have NPM or Yarn package manager installed, since you need TypeScript to compile the project.

---

#### Currently Available Commands

- **`tcc`**: If you installed with `npm install -g typecon`, then use `tcc` directly in the terminal. Otherwise, use `npm tcc` or `yarn tcc`

### Parameters

Usage:
**First time Setup**

- **`setup`**: Creates the project's basic setup including folders, include files, templates and the basic TypeScript configuration

**Compile options**

- **`-i, --input`**: for the file path to be compiled
- **`-if, --input_folder`**: for the path folder to be compiled (compiles all files inside)
- **`-il, --input_list`**: for a list of files to be compiled
- **`-o, --output`**: for the output file name
- **`-of, --output_folder`**: for the output folder path
- **`-lp, --line_print`**: to write the TS lines inside the CON code
- **`-sp, --symbol_print`**: to write the symbols inside the CON code
- **`-ss, --stack_size`**: to define the stack size
- **`-hs, --heap_size`**: to define the heap's size
- **`-ps, --page_size`**: to define the heap page's minimum size
- **`-pn, --page_number`**: to define the default number of heap pages
- **`-hl, --headerless`**: Don't insert the header code (init code and states) inside the output CON
- **`-h, --header`**: Create the header file
- **`-np, --no_precompiled`**: Don't link pre-compiled modules
- **`-l, --link`**: Create the header and the init files with the following list of CON files (separated by "")
- **`-1f, --one_file`**: Compile all the code into one file (must be used with -o)
- **`-di, --default_inclusion`**: Default inclusion (GAME.CON)
- **`-ei, --eduke_init`**: Init file is EDUKE.CON

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

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes.

---

## License

This project is licensed under the GNU General Public License v3. See the LICENSE file for details.

---

## Acknowledgments

Thank you for using this tool to enhance the Build Engine modding experience. We hope it saves you time and effort while bringing your creative ideas to life!
