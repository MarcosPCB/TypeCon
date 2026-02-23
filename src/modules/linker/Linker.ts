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
        isConModule = false,
        private headerless = false,
        private symbolPrint = false
    ) {
        this.isConModule = isConModule;
        this.globalOffset = 0;
    }

    public loadModule(filePath: string) {
        if (!fs.existsSync(filePath)) {
            console.error(colorText(`Error: Module file not found: ${filePath}`, 'red'));
            process.exit(1);
        }

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
            process.exit(1);
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
            this.globalOffset = 0; // Absolute offsets
        }

        this.allocateGlobals(sortedModules);

        if (this.symbolPrint) {
            this.printSymbolTable();
        }

        return { sortedModules, finalInit, globalSize };
    }

    private printSymbolDetails(sym: SymbolDefinition, indent: number): { txt: string, json: any } {
        let txt = '';
        const json: any = {};
        const prefix = ' '.repeat(indent);

        if (sym.children && Object.keys(sym.children).length > 0) {
            txt += `${prefix}Properties:\n`;
            json.properties = [];
            const sortedChildren = Object.entries(sym.children).sort((a, b) => ((a[1] as any).offset || 0) - ((b[1] as any).offset || 0));

            for (const [cName, cSym] of sortedChildren) {
                const cTypeStr = this.getSymbolTypeName(cSym.type);
                const cOff = (cSym as any).offset !== undefined ? (cSym as any).offset : 0;
                const cSize = (cSym as any).size || 1;
                txt += `${prefix}  .${cName.padEnd(31)} off:${cOff.toString().padEnd(4)} size:${cSize.toString().padEnd(4)} type:${cTypeStr}\n`;

                const cJson: any = { name: cName, offset: cOff, size: cSize, type: cTypeStr };
                const cDetails = this.printSymbolDetails(cSym as SymbolDefinition, indent + 4);
                if (cDetails.txt) txt += cDetails.txt;
                Object.assign(cJson, cDetails.json);
                json.properties.push(cJson);
            }
        }

        if ((sym as any).num_elements) {
            txt += `${prefix}Elements: ${(sym as any).num_elements}\n`;
            json.num_elements = (sym as any).num_elements;
        }

        return { txt, json };
    }

    private printSymbolTable() {
        const symbolsTxtPath = path.join(this.outputFolder, 'symbols.txt');
        const symbolsJsonPath = path.join(this.outputFolder, 'symbols.json');

        // User requested simplification: 
        // "just print the global, local variables and sub functions, please, with their addresses and init values"
        // Also: added detailed layout info for objects, arrays, and strings.

        let txtOutput = '=== LINKER SYMBOL TABLE ===\n\n';
        const jsonOutput: any = { globals: [], locals: [], sub_functions: [] };

        // --- 1. Global Variables ---
        txtOutput += '[Global Variables]\n';
        txtOutput += 'Name'.padEnd(35) + 'Address'.padEnd(10) + 'Size      ' + 'Type\n';
        txtOutput += '-'.repeat(70) + '\n';

        const sortedAllocated = Array.from(this.memoryMap.entries()).sort((a, b) => a[1] - b[1]);

        for (const [name, addr] of sortedAllocated) {
            const sym = this.globalSymbolTable.get(name) as SymbolDefinition | undefined;
            if (sym && ((sym.type & ESymbolType.function) || (sym.type & ESymbolType.class) || (sym.type & ESymbolType.enum))) {
                continue; // specific request to avoid functions here
            }

            const size = sym && !(sym.type & ESymbolType.enum) ? ((sym as any).size || 1) : 1;
            const typeStr = sym ? this.getSymbolTypeName(sym.type) : 'unknown';

            txtOutput += `${name.padEnd(35)} ${addr.toString().padEnd(10)} ${size.toString().padEnd(10)} ${typeStr}\n`;

            const gJson: any = { name, address: addr, size, type: typeStr };

            if (sym) {
                const details = this.printSymbolDetails(sym, 2, addr);
                txtOutput += details.txt;
                Object.assign(gJson, details.json);
            }

            jsonOutput.globals.push(gJson);
        }
        txtOutput += '\n';

        // --- 2. Local Variables ---
        txtOutput += '[Local Variables]\n';

        for (const mod of this.modules.values()) {
            const locals = Object.values(mod.context).filter((s: any) => (s as any).parentFunc);

            if (locals.length === 0) continue;

            const byFunc: Record<string, SymbolDefinition[]> = {};
            for (const s of locals) {
                const pFunc = (s as any).parentFunc || 'unknown';
                if (!byFunc[pFunc]) byFunc[pFunc] = [];
                byFunc[pFunc].push(s as SymbolDefinition);
            }

            for (const [funcName, vars] of Object.entries(byFunc)) {
                vars.sort((a: any, b: any) => (a.offset || 0) - (b.offset || 0));

                txtOutput += `Module: ${mod.name}, Function: ${funcName}\n`;
                txtOutput += '  Name'.padEnd(35) + 'Offset'.padEnd(10) + 'Size      ' + 'Type\n';
                txtOutput += '  ' + '-'.repeat(70) + '\n';

                for (const v of vars) {
                    const typeStr = this.getSymbolTypeName(v.type);
                    const offset = (v as any).offset !== undefined ? (v as any).offset : 0;
                    const size = (v as any).size || 1;

                    txtOutput += `  ${v.name.padEnd(33)} ${offset.toString().padEnd(10)} ${size.toString().padEnd(10)} ${typeStr}\n`;

                    const lJson: any = {
                        module: mod.name,
                        function: funcName,
                        name: v.name,
                        offset,
                        size,
                        type: typeStr
                    };

                    const details = this.printSymbolDetails(v, 4, offset);
                    txtOutput += details.txt;
                    Object.assign(lJson, details.json);

                    jsonOutput.locals.push(lJson);
                }
                txtOutput += '\n';
            }
        }

        // --- 3. Sub Functions ---
        txtOutput += '[Sub Functions]\n';
        txtOutput += 'Module'.padEnd(20) + 'Name'.padEnd(35) + 'Type'.padEnd(15) + 'Info\n';
        txtOutput += '-'.repeat(80) + '\n';

        for (const mod of this.modules.values()) {
            const subFuncs = Object.values(mod.context).filter((s: any) => (s.type & ESymbolType.sub_function));

            if (subFuncs.length > 0) {
                subFuncs.sort((a, b) => a.name.localeCompare(b.name));

                for (const s of subFuncs) {
                    const typeStr = this.getSymbolTypeName(s.type);
                    let info = 'N/A';
                    if ((s as any).index !== undefined) info = `idx:${(s as any).index}`;

                    txtOutput += `${mod.name.padEnd(20)} ${s.name.padEnd(35)} ${typeStr.padEnd(15)} ${info}\n`;
                    jsonOutput.sub_functions.push({
                        module: mod.name,
                        name: s.name,
                        type: typeStr,
                        info
                    });
                }
            }
        }

        fs.writeFileSync(symbolsTxtPath, txtOutput);
        fs.writeFileSync(symbolsJsonPath, JSON.stringify(jsonOutput, null, 2));

        console.log(colorText(`\nSymbols details written to: ${symbolsTxtPath}`, 'cyan'));
        console.log(colorText(`Symbols JSON written to: ${symbolsJsonPath}\n`, 'cyan'));
    }

    private getSymbolTypeName(type: ESymbolType): string {
        const types: string[] = [];
        if (type & ESymbolType.number) types.push('number');
        if (type & ESymbolType.string) types.push('string');
        if (type & ESymbolType.boolean) types.push('boolean');
        if (type & ESymbolType.object) types.push('object');
        if (type & ESymbolType.array) types.push('array');
        if (type & ESymbolType.function) types.push('function');
        if (type & ESymbolType.native) types.push('native');
        if (type & ESymbolType.enum) types.push('enum');
        if (type & ESymbolType.constant) types.push('constant');
        if (type & ESymbolType.class) types.push('class');
        if (type & ESymbolType.pointer) types.push('pointer');
        if (type & ESymbolType.module) types.push('module');
        if (type & ESymbolType.sub_function) types.push('sub_function');

        if (types.length === 0) return `unknown(${type})`;
        return types.join('|');
    }

    public linkSeparate() {
        const { sortedModules, finalInit, globalSize } = this.prepareLinking();

        let globalArrayName = '';
        if (this.isConModule) {
            const firstModName = sortedModules[0]?.name || 'mod';
            globalArrayName = this.generateGlobalArrayName(firstModName);
        }

        const header = this.buildHeader(sortedModules, finalInit, globalSize, globalArrayName, true);

        const modules = sortedModules.map(mod => ({
            name: mod.name,
            code: this.patchModule(mod, globalArrayName)
        }));

        return { header, modules };
    }

    public link(): { code: string, header: string } {
        const { sortedModules, finalInit, globalSize } = this.prepareLinking();

        let globalArrayName = '';
        if (this.isConModule) {
            const firstModName = sortedModules[0]?.name || 'mod';
            globalArrayName = this.generateGlobalArrayName(firstModName);
        }

        const fullHeader = this.buildHeader(sortedModules, finalInit, globalSize, globalArrayName, true);
        let output = this.headerless ? "" : fullHeader;

        sortedModules.forEach(mod => {
            output += `// Module: ${mod.name}\n${this.patchModule(mod, globalArrayName)}\n`;
        });

        return { code: output, header: fullHeader };
    }

    private generateGlobalArrayName(firstModName: string): string {
        const prefix = firstModName.substring(0, 4).toLowerCase();
        const random = Math.random().toString(36).substring(2, 10);
        return `GV_${prefix}${random}`;
    }

    private buildHeader(sortedModules: CompiledModule[], finalInit: CONInit, globalSize: number, globalArrayName: string, forceFullHeader = false): string {
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

        if (this.isConModule) {
            const firstModName = sortedModules[0]?.name || 'mod';
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
            if (!this.headerless || forceFullHeader) {
                output += finalInit.initCode + '\n' + finalInit.initStates + '\n';
                if (finalInit.precompiled) {
                    const preComp = finalInit.GetPrecompiledCode();
                    if (preComp) output += preComp;
                }
                output += `// Global Static Storage Start: ${finalInit.stackSize}\n`;
                output += `// Global Static Storage Size: ${globalSize}\n\n`;
            }
        }

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

        const resolveAddr = (match: string, p1: string) => {
            const idx = this.memoryMap.get(p1);
            if (idx === undefined) {
                throw new Error(`Linker Error: Global symbol '${p1}' not found in allocation map for module ${mod.name}.`);
            }

            if (this.isConModule && globalArrayName) {
                return `${globalArrayName}[${idx}]`;
            }
            return idx.toString();
        };

        code = code.replace(/_G_ADDR_([A-Za-z0-9_]+)/g, resolveAddr);
        code = code.replace(/__RELOC_GLOBAL_([A-Za-z0-9_]+)__/g, resolveAddr);

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
