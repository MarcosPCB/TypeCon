
import { CompilerContext, SymbolDefinition, ESymbolType, EnumDefinition } from "../Compiler";
import { visitVariableStatement } from "./visitVariableStatement";
import { visitExpressionStatement } from "./visitExpressionStatement";
import { visitReturnStatement } from "./visitReturnStatement";
import { visitIfStatement } from "./visitIfStatement";
import { visitSwitchStatement } from "./visitSwitchStatement";
import { storeTypeAlias } from "./storeTypeAlias";
import { storeInterface } from "./storeInterface";
import { storeEnum } from "./storeEnum";
import { visitFunctionDeclaration } from "./visitFunctionDeclaration";
import { visitWhileStatement } from "./visitWhileStatement";
import { addDiagnostic } from "./addDiagnostic";
import { ExpressionStatement, ReturnStatement, Statement, SyntaxKind, VariableStatement, IfStatement, SwitchStatement, TypeAliasDeclaration, InterfaceDeclaration, EnumDeclaration, ModuleDeclaration, ModuleDeclarationKind, FunctionDeclaration, WhileStatement } from "ts-morph";
import { ECompileOptions } from "../framework";

// All dependencies are now imported directly
export function visitStatement(stmt: Statement, context: CompilerContext): string {
    let code = ''//`/* ${stmt.getText()} */\n`;
    switch (stmt.getKind()) {
      case SyntaxKind.VariableStatement:
        return code + visitVariableStatement(stmt as VariableStatement, context);

      case SyntaxKind.ExpressionStatement:
        if (context.currentFile.options & ECompileOptions.no_compile)
          return code;

        return code + visitExpressionStatement(stmt as ExpressionStatement, context);

      case SyntaxKind.ReturnStatement:
        if (context.currentFile.options & ECompileOptions.no_compile)
          return code;

        return code + visitReturnStatement(stmt as ReturnStatement, context);

      case SyntaxKind.IfStatement:
        if (context.currentFile.options & ECompileOptions.no_compile)
          return code;

        return code + visitIfStatement(stmt as IfStatement, context);

      case SyntaxKind.SwitchStatement:
        if (context.currentFile.options & ECompileOptions.no_compile)
          return code;

        return code + visitSwitchStatement(stmt as SwitchStatement, context);

      case SyntaxKind.TypeAliasDeclaration:
        storeTypeAlias(stmt as TypeAliasDeclaration, context);
        break;

      case SyntaxKind.InterfaceDeclaration:
        storeInterface(stmt as InterfaceDeclaration, context);
        break;

      case SyntaxKind.EnumDeclaration:
        storeEnum(stmt as EnumDeclaration, context);
        break;

      case SyntaxKind.BreakStatement: {
        if (context.isInLoop)
          code += `exit\n`;
        else
          code += `state popb\njump rb\n`; //switch statements

        return code;
      }

      case SyntaxKind.ModuleDeclaration:
        const md = stmt as ModuleDeclaration;

        const curModule = context.curModule;

        const b = context.currentFile.options;
        const moduleName = md.getName();
        const compilable = md.getDeclarationKind() != ModuleDeclarationKind.Global && !['nocompile', 'noread', 'statedecl'].includes(moduleName);

        if (!compilable)
          context.currentFile.options |= ECompileOptions.no_compile;

        const stmts = (stmt as ModuleDeclaration).getStatements();

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

        let mCode = '';

        stmts.forEach(st => {
          if (!st.isKind(SyntaxKind.ClassDeclaration))
            mCode += visitStatement(st, localCtx);
        });

        if (compilable) {
          const children: { [k: string]: SymbolDefinition | EnumDefinition } = Object.fromEntries([...localCtx.symbolTable].filter(e => !context.symbolTable.has(e[0])));

          context.symbolTable.set(moduleName, {
            name: moduleName,
            type: ESymbolType.module,
            offset: 0,
            children
          });

          code += mCode;
        } else {
          context.symbolTable = localCtx.symbolTable;
          context.typeAliases = localCtx.typeAliases;
        }

        context.curModule = curModule;

        context.currentFile.options = b;
        return code;

      case SyntaxKind.ImportDeclaration:
        return code;

      case SyntaxKind.FunctionDeclaration:
        return code + visitFunctionDeclaration(stmt as FunctionDeclaration, context);

      case SyntaxKind.WhileStatement:
        return code + visitWhileStatement(stmt as WhileStatement, context);

      case SyntaxKind.ExportAssignment:
        return '';

      default:
        addDiagnostic(stmt, context, "warning", `Unhandled statement kind: ${stmt.getKindName()} - ${stmt.getText()}`);
        return code;
    }
  }
