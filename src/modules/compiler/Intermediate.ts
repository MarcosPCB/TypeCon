import { SymbolDefinition, EnumDefinition } from "./Compiler";

export interface RelocationEntry {
    /** 
     * The character index in the 'code' string where the replacement should happen.
     * The placeholder at this location should be replaced by the resolved value.
     */
    offset: number;

    /**
     * The original text/placeholder length that is being replaced.
     * Use this to properly slice the string during replacement.
     */
    length: number;

    /** The name of the symbol being referenced (e.g., "lb100_enabler" or a Class name) */
    symbolName: string;

    /** 
     * The type of relocation:
     * - 'global_offset': Replace with the resolved index in the global flat[] array.
     * - 'function_label': Replace with the resolved CON state/action name.
     * - 'class_offset': Replace with the resolved class offset/ID.
     */
    type: 'global_offset' | 'function_label' | 'class_offset';
}

export interface CompiledModule {
    /** Module name (usually filename without extension) */
    name: string;

    /** TypeCON version used to compile this */
    version: string;

    /** 
     * Full symbol table definition for this module.
     * Use this to resolve types and variable names during linking.
     */
    context: Record<string, SymbolDefinition | EnumDefinition>;

    /**
     * List of global variables that this module needs to allocate.
     * The Linker will assign unique indices to these in the master flat[] array.
     */
    globalAllocations: Array<{ name: string, size: number }>;

    /** The CON code fragment with placeholders for relocatable addresses */
    code: string;

    /** List of other modules (paths or names) this module depends on */
    dependencies: string[];

    /** Custom defines from markers (e.g. LANGUAGE_SET) */
    markerDefines?: string[];
}
