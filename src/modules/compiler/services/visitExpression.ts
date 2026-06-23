import { Expression, SyntaxKind, BinaryExpression, CallExpression, ObjectLiteralExpression, PropertyAccessExpression, NumericLiteral, PrefixUnaryExpression, ParenthesizedExpression, ArrowFunction, FunctionExpression } from "ts-morph";
import { CompilerContext, ESymbolType, SymbolDefinition } from "../Compiler";
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
import { formatLineDetail } from "../helper/formatLineDetail";

/******************************************************************************
   * Expression
   *****************************************************************************/
export function visitExpression(expr: Expression, context: CompilerContext, reg = 'ra', direct = false): string {
  let code = ''//`/* ${expr.getText()} */\n`;
  context.curExpr = ESymbolType.number;
  context.curFpBits = 0;
  context.curSymRet = null;

  // If the expression is a GameLabel/Sound identifier, emit the label name directly
  // so that VARIABLE-path native args (e.g. sound BARREL_BOOM) use the define name.
  if (expr.isKind(SyntaxKind.Identifier)) {
    const labelSym = context.symbolTable.get(expr.getText()) as SymbolDefinition;
    if (labelSym?.isLabel) {
      context.curExpr = ESymbolType.number | ESymbolType.constant;
      return `set ${reg} ${labelSym.name}\n`;
    }
  }

  const val = evaluateLiteralExpression(expr, context);

  if (typeof val === 'number') {
    // If the value is a non-integer float and there's an FP context hint, convert to
    // the integer FP representation at compile time (e.g. Math.sin(1.93) → set r0 3952).
    const fpBits = (context.nativeArgFpHint || context.curFpBits) as number;
    const isFloatLit = expr.isKind(SyntaxKind.NumericLiteral) && expr.getText().includes('.');
    // Fall back to declared FP type, then FP16 default for float literals with no context
    const effectiveFp = fpBits || (isFloatLit ? (context.declaredFpBits || 16) : 0);
    let emitVal: number = val;
    if ((!Number.isInteger(val) || isFloatLit) && effectiveFp > 0) {
      emitVal = Math.round(val * (1 << effectiveFp));
      context.curFpBits = effectiveFp as (0 | 11 | 14 | 16 | 30);
    }
    return (context.options.lineDetail ? formatLineDetail(`Evaluated: ${expr.getText()}`) : '') + `set ${reg} ${emitVal}\n`;
  }

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