import { WhileStatement, SyntaxKind } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { indent } from "../helper/indent";
import { parseIfCondition } from "./parseIfCondition";
import { visitExpression } from "./visitExpression";
import { visitStatement } from "./visitStatement";
import { formatLineDetail } from "../helper/formatLineDetail";

/******************************************************************************
   * while statements
   *****************************************************************************/
export function visitWhileStatement(ws: WhileStatement, context: CompilerContext): string {
  let code = context.options.lineDetail ? formatLineDetail(ws.getText()) : '';

  context.isInLoop = true;

  const useRD = context.usingRD;
  context.usingRD = true;

  // Save localVarCount BEFORE pushd so we can fully restore it after popd.
  // state pushd uses one flat[] stack slot — account for it so inner variables
  // get the correct rbp-relative offsets.
  const savedBeforePushd = context.localVarCount;

  if (useRD) {
    code += `state pushd\n`;
    context.localVarCount += 1;
  }

  const pattern = parseIfCondition(ws.getExpression(), context);
  const right = typeof pattern.right === 'number' ? `set rd ${pattern.right}\n`
    : (visitExpression(pattern.right, context) + `set rd ra\n`);

  const left = typeof pattern.left === 'number' ? `set rb ${pattern.left}\n`
    : (visitExpression(pattern.left, context) + `set rb ra\n`);

  const ifCode = `${right}\n${left}\nset ra 1\n${pattern.op} rb rd\n  set ra 0\n`;
  code += ifCode + 'set rc 0\nwhilen ra 1 {\n' + indent('state pushc\n', 1);

  // pushc occupies one stack slot inside the loop body. Bump localVarCount so
  // that any local variables declared inside the loop get correct rbp-relative
  // offsets (i.e., offset = slot distance from rbp, accounting for pushd + pushc).
  const savedLoopCount = context.localVarCount;
  context.localVarCount += 1;

  const block = ws.getStatement();
  if (block.isKind(SyntaxKind.Block)) {
    const stmts = block.getStatements();
    stmts.forEach(stmt => {
      code += visitStatement(stmt, context);
    });
  }

  // Emit cleanup for any locals allocated inside the loop body so the stack is
  // stable across iterations (only the pushc slot remains before popc).
  const loopBodySlots = context.localVarCount - savedLoopCount - 1;
  if (loopBodySlots > 0)
    code += indent(`sub rsp ${loopBodySlots}\n`, 1);

  context.localVarCount = savedLoopCount;

  code += indent(ifCode + 'state popc\nadd rc 1\n', 1);
  code += '}\n';

  // Restore to pre-pushd count; state popd will physically remove the slot.
  context.localVarCount = savedBeforePushd;

  context.isInLoop = false;
  context.usingRD = useRD;

  if (useRD)
    code += `state popd\n`;

  return code;
}