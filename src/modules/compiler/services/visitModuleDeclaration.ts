import { ModuleDeclaration, ModuleDeclarationKind, SyntaxKind, Statement, FunctionDeclaration, ClassDeclaration } from "ts-morph";
import { CompilerContext, ESymbolType, SymbolDefinition, EnumDefinition } from "../Compiler";
import { ECompileOptions } from "../framework";
import { visitStatement } from "./visitStatement";
import { visitFunctionDeclaration } from "./visitFunctionDeclaration";
import { visitClassDeclaration } from "./visitClassDeclaration";

export function visitModuleDeclaration(md: ModuleDeclaration, context: CompilerContext): { definitions: string, initialization: string } {
    const curModule = context.curModule;

    const b = context.currentFile.options;
    const moduleName = md.getName();
    const compilable = md.getDeclarationKind() != ModuleDeclarationKind.Global && !['nocompile', 'noread', 'statedecl'].includes(moduleName);

    if (!compilable)
        context.currentFile.options |= ECompileOptions.no_compile;

    const stmts = md.getStatements();

    if (compilable)
        context.symbolTable.set(moduleName, {
            name: moduleName,
            type: ESymbolType.module,
            offset: 0
        });

    const localCtx: CompilerContext = {
        ...context,
        symbolTable: new Map(context.symbolTable),
        curModule: compilable ? context.symbolTable.get(moduleName) as SymbolDefinition : curModule
    };

    // Snapshot the symbol table BEFORE visiting statements.  A module function that
    // shares a name with a pre-existing symbol (e.g. JSON.fromRecord vs CJson.fromRecord)
    // overwrites the key in localCtx.symbolTable.  We need to detect that overwrite so
    // the new definition ends up in the module's children, not silently excluded.
    const preVisitSnapshot = compilable ? new Map(localCtx.symbolTable) : null;

    let definitions = '';
    let initialization = '';

    stmts.forEach(st => {
        if (st.isKind(SyntaxKind.FunctionDeclaration)) {
            definitions += visitFunctionDeclaration(st as FunctionDeclaration, localCtx);
        } else if (st.isKind(SyntaxKind.ClassDeclaration)) {
            if (!(context.currentFile.options & ECompileOptions.no_compile))
                definitions += visitClassDeclaration(st as ClassDeclaration, localCtx);
        } else if (st.isKind(SyntaxKind.ModuleDeclaration)) {
            const result = visitModuleDeclaration(st as ModuleDeclaration, localCtx);
            definitions += result.definitions;
            initialization += result.initialization;
        } else {
            initialization += visitStatement(st, localCtx);
        }
    });

    if (compilable) {
        // Include a symbol in children if it is (a) brand-new, or (b) its value changed
        // from the pre-visit snapshot (i.e. the module redefined a pre-existing name).
        const children: { [k: string]: SymbolDefinition | EnumDefinition } = Object.fromEntries(
            [...localCtx.symbolTable].filter(e =>
                !preVisitSnapshot!.has(e[0]) ||           // new symbol
                preVisitSnapshot!.get(e[0]) !== e[1]      // overwritten symbol
            )
        );

        context.symbolTable.set(moduleName, {
            name: moduleName,
            type: ESymbolType.module,
            offset: 0,
            children
        });
    } else {
        context.symbolTable = localCtx.symbolTable;
        context.typeAliases = localCtx.typeAliases;
    }

    context.globalVarCount = localCtx.globalVarCount;
    context.curModule = curModule;
    context.currentFile.options = b;

    return { definitions, initialization };
}
