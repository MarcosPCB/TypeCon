import { ObjectLiteralExpression } from "ts-morph";
import { CompilerContext, ESymbolType } from "../Compiler";
import { ECompileOptions } from "../framework";
import { processObjectLiteral } from "./processObjectLiteral";
import { getVarNameForObjectLiteral } from "./getVarNameForObjectLiteral";

export function visitObjectLiteral(objLit: ObjectLiteralExpression, context: CompilerContext): string {
    const result = processObjectLiteral(objLit, context);
    // If the object literal is assigned to a variable, retrieve its name.
    const varName = getVarNameForObjectLiteral(objLit);
    if (varName) {
      // Store the layout in the global symbol table.
      context.symbolTable.set(varName, { name: varName, type: ESymbolType.object, offset: context.localVarCount + 1, size: result.size, children: result.layout });
      result.code += context.options.lineDetail ? `/*Symbol ${JSON.stringify(context.symbolTable.get(varName), undefined, 2)}*/\n` : '';
    }
    if (context.currentFile.options & ECompileOptions.no_compile)
      return '';

    context.localVarCount += result.instanceSize - 1;
    return result.code + `set ra rbp\nadd ra ${context.localVarCount - result.size}\nset rf 0\n`;
  }