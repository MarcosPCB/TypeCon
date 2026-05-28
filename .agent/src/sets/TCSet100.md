# Native Sets (TCSet100) Skill

The `src/sets/TCSet100` directory is the bridge between TypeScript and the Build Engine's hardcoded entities, providing type safety and code-generation rules.

## Core Components

### `types.ts`
- Contains TypeScript interfaces for native Duke3D actors, sprites, and properties (e.g., `CActor`, `CSector`, `CWall`).
- Special wrapper `CON_NATIVE<T>` is used extensively to tell the compiler: "Do not allocate this on the `flat` array; this maps to a built-in engine structure".
- Edits here provide intellisense and type-checking to the modder.

### `native.ts`
- Contains the `nativeFunctions` array.
- This is the translation map that tells the compiler how to convert a TS function call (e.g., `Math.sin(x)`) into CON instructions.
- Some mappings are simple strings (`"fall "`), while complex mappings use generator functions to emit multiple instructions.

### `DN3D/game.ts`
- Contains classic Duke3D enumerations (Names, Sounds, Music).

### `precompile/`
- Contains reusable TypeScript modules that get compiled down to `.con` files automatically during the build process (`postBuild.js`). These are shipped alongside the tool.

## Agent Guidelines
- If a modder needs access to a new EDuke32 feature or variable, you must declare it in `types.ts` and map its behavior in `native.ts`.
- When making changes inside `src/sets/`, always remind the user to run `yarn build` so that `postBuild.js` can copy the new definitions into the `include/` directory shipped with the final package.
