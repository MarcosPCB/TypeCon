import { Expression, SyntaxKind, BinaryExpression, CallExpression, ObjectLiteralExpression, PropertyAccessExpression, NumericLiteral, PrefixUnaryExpression, ParenthesizedExpression, ArrowFunction, FunctionExpression } from "ts-morph";
import { CompilerContext, ESymbolType } from "../Compiler";
import { evaluateLiteralExpression } from "../helper/helpers";
import { visitBinaryExpression } from "./visitBinaryExpression";
import { visitCallExpression } from "./visitCallExpression";
import { visitArrowFunctionExpression } from "./visitArrowFunctionExpression";
import { visitMemberExpression } from "./visitMemberExpression";
import { visitObjectLiteral } from "./visitObjectLiteral";
import { visitLeafOrLiteral } from "./visitLeafOrLiteral";
import { visitParenthesizedExpression } from "./visitParenthesizedExpression";
import { visitUnaryExpression } from "./visitUnaryExpression";
import { subFunctionInit } from "./subFunctionInit";

/******************************************************************************
   * Expression
   *****************************************************************************/
export function visitExpression(expr: Expression, context: CompilerContext, reg = 'ra', direct = false): string {
    let code = ''//`/* ${expr.getText()} */\n`;
    context.curExpr = ESymbolType.number;
    context.curSymRet = null;

    const val = evaluateLiteralExpression(expr, context);

    if(typeof val === 'number')
      return (context.options.lineDetail ? `/* Evaluated: ${expr.getText()}*/\n` : '') + `set ${reg} ${val}\n`;

    switch (expr.getKind()) {
      case SyntaxKind.BinaryExpression:
        return code + visitBinaryExpression(expr as BinaryExpression, context, reg);

      case SyntaxKind.CallExpression:
        return code + visitCallExpression(expr as CallExpression, context, reg);

      case SyntaxKind.ObjectLiteralExpression:
        return code + visitObjectLiteral(expr as ObjectLiteralExpression, context);

      case SyntaxKind.PropertyAccessExpression:
      case SyntaxKind.ElementAccessExpression:
        return code + visitMemberExpression(expr, context, undefined, false, reg);

      case SyntaxKind.PrefixUnaryExpression:
      case SyntaxKind.PostfixUnaryExpression:
        return code + visitUnaryExpression(expr, context, reg);

      case SyntaxKind.ParenthesizedExpression:
        return code + visitParenthesizedExpression(expr as ParenthesizedExpression, context, reg);

      case SyntaxKind.ArrowFunction:
        subFunctionInit(expr as ArrowFunction, context);
        return code + `state pushsi\nset rsi ${context.subFunction.index * 100 + 0x10000}\nstate _subFunctions_${context.subFunction.hash}\nstate popsi\n`;

      case SyntaxKind.FunctionExpression:
        subFunctionInit(expr as FunctionExpression, context);
        return code + `state pushsi\nset rsi ${context.subFunction.index * 100 + 0x10000}\nstate _subFunctions_${context.subFunction.hash}\nstate popsi\n`;

      default:
        return code + visitLeafOrLiteral(expr, context, undefined, reg);
    }
  }