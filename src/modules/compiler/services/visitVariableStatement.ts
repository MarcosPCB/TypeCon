import { VariableStatement } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { ECompileOptions } from "../framework";
import { visitVariableDeclaration } from "./visitVariableDeclaration";

/******************************************************************************
   * variable statements => local var
   *****************************************************************************/
export function visitVariableStatement(node: VariableStatement, context: CompilerContext): string {
    let code = '';
    if (!(context.currentFile.options & ECompileOptions.no_compile))
      code = context.options.lineDetail ? `/*${node.getText()}*/\n` : '';

    const decls = node.getDeclarationList().getDeclarations();
    for (const d of decls) {
      code += visitVariableDeclaration(d, context);
    }
    return code;
  }