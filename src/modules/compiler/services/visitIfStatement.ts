import { IfStatement, Expression, BinaryExpression, PropertyAccessExpression, Statement, Block, SyntaxKind } from "ts-morph";
import { CompilerContext, CompilerOptions } from "../Compiler";
import { indent } from "../helper/indent";
import { visitBlockOrStmt } from "./visitBlockOrStmt";
import { visitExpression } from "./visitExpression";
import { parseIfCondition } from "./parseIfCondition";
import { formatLineDetail } from "../helper/formatLineDetail";

/**
 * Returns true if every code path through `stmt` ends with a return (terminate).
 * Used to detect early-returning if-branches so we can safely reset localVarCount
 * after them, preventing sequential mutually-exclusive branches from accumulating
 * offset drift (e.g. Stringify's t==5 branch consuming offsets before t==6).
 */
function blockAlwaysReturns(stmt: Statement): boolean {
  if (stmt.isKind(SyntaxKind.ReturnStatement)) return true;
  if (stmt.isKind(SyntaxKind.Block)) {
    const stmts = (stmt as Block).getStatements();
    if (stmts.length === 0) return false;
    return blockAlwaysReturns(stmts[stmts.length - 1]);
  }
  if (stmt.isKind(SyntaxKind.IfStatement)) {
    const is = stmt as IfStatement;
    const elseStmt = is.getElseStatement();
    return !!(elseStmt &&
              blockAlwaysReturns(is.getThenStatement()) &&
              blockAlwaysReturns(elseStmt));
  }
  return false;
}

/******************************************************************************
   * if => must be (A && B), (A || B), or !(A || B)
   *****************************************************************************/
export function visitIfStatement(is: IfStatement, context: CompilerContext): string {
  let code = context.options.lineDetail ? formatLineDetail(is.getText()) : '';
  const pattern = parseIfCondition(is.getExpression(), context);

  // Save localVarCount so early-returning branches don't shift offsets for
  // subsequent branches. Each branch starts from the same frame position.
  const savedVarCount = context.localVarCount;
  const thenPart = visitBlockOrStmt(is.getThenStatement(), context);
  if (blockAlwaysReturns(is.getThenStatement())) {
    context.localVarCount = savedVarCount;
  }
  const elsePart = is.getElseStatement() ? visitBlockOrStmt(is.getElseStatement()!, context) : "";
  if (is.getElseStatement() && blockAlwaysReturns(is.getElseStatement()!)) {
    context.localVarCount = savedVarCount;
  }

  if (!pattern) {
    code += `// invalid if condition fallback\nset rd 0\nset ra 1\nifand rd ra {\n${indent(thenPart, 1)}\n} else {\n${indent(elsePart, 1)}\n}\n`;
    return code;
  }

  //if(useRD)
  //code += `state pushd\n`;
  // Evaluate left side normally
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
  // For the right side, check if it's a number or an Expression.
  code += context.options.lineDetail ? `// 'if' right side\n` : '';
  let rightCode = '';
  if (typeof pattern.right === "number")
    rightCode = `${pattern.right}`;
  else
    code += visitExpression(pattern.right, context);

  code += `${pattern.op} ${leftCode != '' ? leftCode : 'rd'} ${rightCode != '' ? rightCode : 'ra'} `;

  if (thenPart.split('\n').length > 1)
    code += `{`;
  code += `\n`;
  code += indent(thenPart, 1);
  if (elsePart != '') {
    if (thenPart.split('\n').length > 1)
      code += `} `;
    code += `else `;
    if (elsePart.split('\n').length > 1)
      code += `{`;
    code += `\n`;
    code += indent(elsePart, 1);
    if (elsePart.split('\n').length > 1)
      code += `}\n`;
  } else if (thenPart.split('\n').length > 1)
    code += `}\n`;

  //if(useRD)
  //code += `state popd\n`

  context.usingRD = useRD;

  return code;
}