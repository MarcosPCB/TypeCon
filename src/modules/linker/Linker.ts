import fs from 'fs';
import path from 'path';
import { CompiledModule } from '../compiler/Intermediate';
import { SymbolDefinition, ESymbolType, EnumDefinition } from '../compiler/Compiler';
import { CONInit } from '../compiler/framework';
import { colorText } from '../../main';

export class Linker {
    private modules: Map<string, CompiledModule> = new Map();
    private globalSymbolTable: Map<string, SymbolDefinition | EnumDefinition> = new Map();
    // Map of global variable name -> allocated flat[] index
    private memoryMap: Map<string, number> = new Map();

    // Starting index for global variables (after framework reserved space)
    // We'll let the CONInit framework tell us what the base is, or assume a safe start.
    // Ideally this comes from the header generation logic.
    private isConModule = false;
    private globalOffset = 0;

    constructor(
        private outputFolder: string,
        private frameworkInit: CONInit,
        isConModule = false
    ) {
        this.isConModule = isConModule;
        this.globalOffset = 0;
    }

    public loadModule(filePath: string) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const mod = JSON.parse(content) as CompiledModule;

            if (this.modules.has(mod.name)) {
                //console.warn(colorText(`Warning: Duplicate module '${mod.name}' loaded. Overwriting.`, 'yellow'));
            }
            this.modules.set(mod.name, mod);

            console.log(`Loaded module: ${mod.name} (${filePath})`);
        } catch (e) {
            console.error(colorText(`Error loading module ${filePath}: ${e}`, 'red'));
            throw e;
        }
    }

    private prepareLinking() {
        console.log(colorText('Linking modules...', 'cyan'));

        // 0. Sort Modules by Dependency (Topological Sort)
        const sortedModules = this.sortModules();

        // 1. Merge Symbols & Check Conflicts
        this.mergeSymbols(sortedModules);

        // 2. Count Globals size
        const globalSize = this.calculateGlobalSize(sortedModules);

        // Re-init framework with known global size
        const config = this.frameworkInit;
        const finalInit = new CONInit(
            config.stackSize,
            config.heapPageSize,
            config.heapNumPages,
            config.precompiled,
            config.heapSize,
            globalSize,
            config.acceptConModules
        );

        // 3. Allocate Indices (Local to the module if CON module, or absolute if regular)
        if (this.isConModule) {
            this.globalOffset = 0; // Relative offsets
        } else {
            this.globalOffset = finalInit.stackSize; // Absolute offsets
        }

        this.allocateGlobals(sortedModules);

        return { sortedModules, finalInit, globalSize };
    }

    public linkSeparate() {
        const { sortedModules, finalInit, globalSize } = this.prepareLinking();

        let header = '';
        if (!this.isConModule) {
            header = finalInit.initCode + '\n' + finalInit.initStates + '\n';
            header += `// Global Static Storage Start: ${finalInit.stackSize}\n`;
            header += `// Global Static Storage Size: ${globalSize}\n\n`;
        }

        const modules = sortedModules.map(mod => ({
            name: mod.name,
            code: this.patchModule(mod)
        }));

        return { header, modules };
    }

    public link(): string {
        const { sortedModules, finalInit, globalSize } = this.prepareLinking();

        let output = '';

        // Collect all unique marker defines from all modules
        const allMarkers = new Set<string>();
        for (const mod of this.modules.values()) {
            if (mod.markerDefines) {
                for (const m of mod.markerDefines) allMarkers.add(m);
            }
        }
        if (allMarkers.size > 0) {
            output += `// Language Set Markers\n${Array.from(allMarkers).join('\n')}\n\n`;
        }

        let globalArrayName = '';

        if (this.isConModule) {
            const firstModName = sortedModules[0]?.name || 'mod';
            const prefix = firstModName.substring(0, 4).toLowerCase();
            const random = Math.random().toString(36).substring(2, 10);
            globalArrayName = `GV_${prefix}${random}`;

            output += `// CON Module: ${firstModName}\n`;
            output += `array ${globalArrayName} ${globalSize}\n\n`;

            output += `appendevent EVENT_INIT\n`;
            output += `  ife ACCEPT_CON_MODULES 0\n`;
            output += `    {\n`;
            output += `      qputs 1024 ERROR: Game does not accept CON modules. Required by ${firstModName}.\n`;
            output += `      echo 1024\n`;
            output += `      nullop // or game_quit\n`;
            output += `    }\n`;

            // Data format check
            let modLangSet: string | null = null;
            let modLangVersion: number | null = null;
            if (sortedModules[0]?.markerDefines) {
                for (const def of sortedModules[0].markerDefines) {
                    const setMatch = def.match(/define LANGUAGE_SET (0x[0-9A-F]+)/);
                    if (setMatch) modLangSet = setMatch[1];
                    const verMatch = def.match(/define LANGUAGE_SET_VERSION (\d+)/);
                    if (verMatch) modLangVersion = parseInt(verMatch[1]);
                }
            }

            if (modLangSet) {
                output += `  ifn LANGUAGE_SET ${modLangSet}\n`;
                output += `    {\n`;
                output += `      qputs 1024 ERROR: Language set mismatch. Required by ${firstModName}: ${modLangSet}.\n`;
                output += `      echo 1024\n`;
                output += `    }\n`;
            }

            if (modLangVersion !== null) {
                output += `  ifg LANGUAGE_SET_VERSION ${modLangVersion}\n`;
                output += `    {\n`;
                output += `      qputs 1024 ERROR: Language set version is too new for this game. Required by ${firstModName}: <= ${modLangVersion}.\n`;
                output += `      echo 1024\n`;
                output += `    }\n`;
            }

            output += `endevent\n\n`;

            output += `appendevent EVENT_NEWGAME\n`;
            // Set offsets in global array based on rsp tracking
            const initializedGlobals = new Set<string>();
            for (const mod of sortedModules) {
                if (mod.globalAllocations) {
                    for (const alloc of mod.globalAllocations) {
                        if (initializedGlobals.has(alloc.name)) continue;
                        initializedGlobals.add(alloc.name);

                        const relativeOffset = this.memoryMap.get(alloc.name);
                        const size = alloc.size || 1;

                        output += `  add rsp 1\n`;
                        output += `  setarray ${globalArrayName}[${relativeOffset}] rsp // ${alloc.name}\n`;
                        if (size > 1) {
                            output += `  add rsp ${size - 1}\n`;
                        }
                    }
                }
            }
            output += `endevent\n\n`;
        } else {
            output += finalInit.initCode + '\n' + finalInit.initStates + '\n';
            output += `// Global Static Storage Start: ${finalInit.stackSize}\n`;
            output += `// Global Static Storage Size: ${globalSize}\n\n`;
        }

        sortedModules.forEach(mod => {
            output += `// Module: ${mod.name}\n${this.patchModule(mod, globalArrayName)}\n`;
        });

        return output;
    }

    private sortModules(): CompiledModule[] {
        const sorted: CompiledModule[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        const visit = (modName: string) => {
            if (visited.has(modName)) return;
            if (visiting.has(modName)) {
                //console.warn(colorText(`Warning: Circular dependency detected involving '${modName}'`, 'yellow'));
                return;
            }

            visiting.add(modName);

            const mod = this.modules.get(modName);
            if (mod) {
                for (const dep of mod.dependencies || []) {
                    // Start: Dependency resolution check (Optional: Auto-load?)
                    if (!this.modules.has(dep)) {
                        //console.warn(colorText(`Warning: Module '${modName}' depends on '${dep}' which is not loaded.`, 'yellow'));
                    }
                    visit(dep);
                }
                sorted.push(mod);
            }

            visiting.delete(modName);
            visited.add(modName);
        };

        for (const modName of this.modules.keys()) {
            visit(modName);
        }

        return sorted;
    }

    private mergeSymbols(modules: CompiledModule[]) {
        for (const mod of modules) {
            for (const [name, sym] of Object.entries(mod.context)) {
                this.globalSymbolTable.set(name, sym as any);
            }
        }
    }

    private calculateGlobalSize(modules: CompiledModule[]): number {
        const tempMap = new Set<string>();
        let size = 0;
        for (const mod of modules) {
            if (mod.globalAllocations) {
                for (const alloc of mod.globalAllocations) {
                    if (!tempMap.has(alloc.name)) {
                        tempMap.add(alloc.name);
                        size += (alloc.size || 1);
                    }
                }
            }
        }
        return size;
    }

    private allocateGlobals(modules: CompiledModule[]) {
        for (const mod of modules) {
            if (mod.globalAllocations) {
                for (const alloc of mod.globalAllocations) {
                    if (!this.memoryMap.has(alloc.name)) {
                        const addr = this.globalOffset;
                        this.memoryMap.set(alloc.name, addr);
                        this.globalOffset += (alloc.size || 1);
                    }
                }
            }
        }
    }

    private patchModule(mod: CompiledModule, globalArrayName?: string): string {
        let code = mod.code;

        code = code.replace(/_G_ADDR_([A-Za-z0-9_]+)/g, (match, p1) => {
            const idx = this.memoryMap.get(p1);
            if (idx === undefined) {
                throw new Error(`Linker Error: Global symbol '${p1}' not found in allocation map for module ${mod.name}.`);
            }

            if (this.isConModule && globalArrayName) {
                // In CON-module mode, we use the global array access pattern:
                // Note: The user said marker replaced by GV_...[offset].
                // Usually markers are used like: set ri _G_ADDR_var -> set ri GV_...[offset]
                // But markers are usually just the address. 
                // If it's replaced by GV_...[offset], and flat[ri] is used later... that won't work unless ri is the value?
                // No, the user says "the markes would be replaced by e.g. GV_modu56bs9fj7[<variable offset>]".
                // In CON, array access is array[index].
                // So "set ri _G_ADDR_x" -> "set ri GV_...[offset]". This is invalid CON if it's meant to be an address.
                // Wait, if GV_... is an array, then GV_...[offset] is a variable.
                // If the marker is used where an address is expected, we probably should replace the WHOLE access pattern?
                // Standard TCO uses:
                // set ri _G_ADDR_x
                // setarray flat[ri] ra  (for assignment)
                // or
                // set ra flat[ri] (for read)

                // If we replace _G_ADDR_x with a variable, then flat[GV_...[offset]]?
                // No, the user says "replaced by GV_...[offset]".
                // This implies the module should be refactored to use the GV_ array directly for storage?
                // Or maybe GV_ array HOLDS the final addresses in 'flat'.
                return `${globalArrayName}[${idx}]`;
            }
            return idx.toString();
        });

        if (this.isConModule && globalArrayName) {
            // We also need to change 'flat[' to globalArrayName + '[' if the module is supposed to use its own storage.
            // But usually 'flat' is the framework's memory.
            // The user's request "GV_...[offset]" suggests that GV_ IS the array.
            // So code that was 'setarray flat[ri] ra' where 'ri' was '_G_ADDR_x' 
            // would become 'setarray flat[GV_...[offset]] ra' if GV holds addresses.
            // OR 'setarray GV_...[offset] ra' if GV holds values.
            // CON syntax for setarray: setarray <array>[<index>] <value>.
            // If marker is replaced by GV_...[idx], then 'set ri GV_...[idx]' followed by 'setarray flat[ri] ra' works if GV holds indices.
            // But that's double indexing.
        }

        return code;
    }
}
