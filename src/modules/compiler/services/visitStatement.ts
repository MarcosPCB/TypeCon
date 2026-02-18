
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
import { ExpressionStatement, ReturnStatement, Statement, SyntaxKind, VariableStatement, IfStatement, SwitchStatement, TypeAliasDeclaration, InterfaceDeclaration, EnumDeclaration, FunctionDeclaration, WhileStatement } from "ts-morph";
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
      return '';

    case SyntaxKind.InterfaceDeclaration:
      storeInterface(stmt as InterfaceDeclaration, context);
      return '';

    case SyntaxKind.EnumDeclaration:
      storeEnum(stmt as EnumDeclaration, context);
      return '';

    case SyntaxKind.BreakStatement: {
      if (context.isInLoop)
        code += `exit\n`;
      else
        code += `state popb\njump rb\n`; //switch statements

      return code;
    }

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
