import { IfStatement, Expression, BinaryExpression, PropertyAccessExpression } from "ts-morph";
import { CompilerContext, CompilerOptions } from "../Compiler";
import { indent } from "../helper/indent";
import { visitBlockOrStmt } from "./visitBlockOrStmt";
import { visitExpression } from "./visitExpression";
import { parseIfCondition } from "./parseIfCondition";

/******************************************************************************
   * if => must be (A && B), (A || B), or !(A || B)
   *****************************************************************************/
export function visitIfStatement(is: IfStatement, context: CompilerContext): string {
    let code = context.options.lineDetail ? `/*${is.getText().trim()}*/\n` : '';
    const pattern = parseIfCondition(is.getExpression(), context);
    const thenPart = visitBlockOrStmt(is.getThenStatement(), context);
    const elsePart = is.getElseStatement() ? visitBlockOrStmt(is.getElseStatement()!, context) : "";

    if (!pattern) {
      code += `// invalid if condition fallback\nset rd 0\nset ra 1\nifand rd ra {\n${indent(thenPart, 1)}\n} else {\n${indent(elsePart, 1)}\n}\n`;
      return code;
    }

    //if(useRD)
      //code += `state pushd\n`;
    // Evaluate left side normally
    code += context.options.lineDetail ? `// 'if' left side\n` : '';
    let leftCode = '';
    if (typeof pattern.left === "number")
      leftCode = String(pattern.left);
    else 
      code += visitExpression(pattern.left, context, 'rd');

    const useRD = context.usingRD;
    context.usingRD = true;

    // For the right side, check if it's a number or an Expression.
    code += context.options.lineDetail ? `// 'if' right side\n` : '';
    let rightCode = '';
    if (typeof pattern.right === "number")
      rightCode = `${pattern.right}`;
    else
      code += visitExpression(pattern.right, context);

    code += `${pattern.op} ${leftCode != '' ? leftCode : 'rd'} ${rightCode != '' ? rightCode : 'ra'} `;

    if(thenPart.split('\n').length > 1)
      code += `{`;
    code += `\n`;
    code += indent(thenPart, 1);
    if (elsePart != '') {
      if(thenPart.split('\n').length > 1)
        code += `} `;
      code += `else `;
      if(elsePart.split('\n').length > 1)
        code += `{`;
      code += `\n`;
      code += indent(elsePart, 1);
      if(elsePart.split('\n').length > 1)
        code += `}\n`;
    } else if(thenPart.split('\n').length > 1)
        code += `}\n`;

    //if(useRD)
      //code += `state popd\n`

    context.usingRD = useRD;

    return code;
  }