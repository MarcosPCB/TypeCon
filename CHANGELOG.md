# Changelog

## [v0.7.0]

### Added
- **Separate Compilation & Linking**: Introduced the `Linker` module and `.tco` intermediate format.
- **Project Structure**: Revamped `setup` command with template support and VS Code plugin automatic configuration.
- **Relocatable CON Modules**: Added support for generating relocatable modules with global array storage.
- **Enhanced CLI**: 
  - New `-L, --linker` for combining intermediate files.
  - New `-ic, --intermediate-code` for raw CON output.
  - New `-sep, --separate` for modular linking.
  - New `-m, --module` for explicit module-mode compilation.
  - New `-C, --clean` for project cleanup.
- **Modern JS Operators**: Added support for **Spread Operator (...)** in object and array literals.
- **Documentation**: Comprehensive [Technical Architecture](file:///Users/mp/.gemini/antigravity/brain/f8762337-2946-4431-975c-414cacc7a35f/Architecture.md) guide covering memory, strings, and module sets.

### Changed
- Improved garbage collection efficiency and stack management.
- Revamped `CFile` and `DN3D` module integration for better performance.
- Simplified CLI flags for better readability and alias support (e.g., `-dl` for `-lp`).

### Fixed
- Fixed circular dependency issues in multi-file project compilation.
- Resolved various member expression transpilation bugs within actor classes.
- Fixed: Language set markers (`LANGUAGE_SET_VERSION`, `LANGUAGE_SET`) now correctly only appear in the project header and are omitted from individual compiled modules.


## [v0.6.0]

### Fixed
- Fixed creating init files with wrong names.
- Fixed files section at package.json.
- Fixed copying include files path.
- Fixed not creating the generated folder at the precompiled modules.
- Fixed evaluateLiteralExpression not taking constants into account.
- Fixed native structure variables override_code not setting up properly the current player index.
- Fixed evaluateLiteralExpression not properly evaluating the symbols in the compiler's context.
- Fixed visitMemberExpression not compiling when an array is found inside a nested object (native).
- Fixed native objects not working when inside actor class using this.
- Fixed not logging when input file wasn't found.
- Fixed PrintStackAndHeap not checking if the current stack is not greater than the available memory.

### Added
- Added documentation about installing it globally.
- Added the constant definition of the Assault Trooper picnum to the template.
- Added complete list of properties for CPlayer.
- Implemented for CPlayer: weaponSystem, pos, previousPos, vel, currSector,curSectorID, ang, previousAng, angVel, horiz, horizOff,verticalAngle, verticalAngleOff.
- Added symbol_print for printing symbols in CLI.
- Added isPlayer to CompilerContext.
- Added version check.
- Added --heap_size or -hs CLI to define the heap size.
- Added more events to the event list.
- Added the proper objects for each weapon variables.
- Started working on a proper New Weapon System.
- Added instructions on how to get started.

### Changed
- Changed lineDetail to line_print.
- Refactored the heap memory system: every page has a minimum size of PAGE_SIZE and a maximum of 4 GB. This way the entire system for memory allocation, deallocation and the Garbage Collector is more efficient with fewer loops.

### Removed
- Removed pkg (not working as intended).
- Removed old references to NWS.
- Removed unused code for the debug mode.
- Removed debugger module references.
