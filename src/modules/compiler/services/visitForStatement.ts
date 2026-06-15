import { ForStatement, SyntaxKind, VariableDeclarationList } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { indent } from "../helper/indent";
import { parseIfCondition } from "./parseIfCondition";
import { visitExpression } from "./visitExpression";
import { visitBlockOrStmt } from "./visitBlockOrStmt";
import { visitVariableDeclaration } from "./visitVariableDeclaration";
import { formatLineDetail } from "../helper/formatLineDetail";

export function visitForStatement(fs: ForStatement, context: CompilerContext): string {
  let code = context.options.lineDetail ? formatLineDetail(fs.getText()) : '';

  context.isInLoop = true;

  const useRD = context.usingRD;
  context.usingRD = true;

  // Save localVarCount BEFORE pushd so it can be fully restored after popd.
  // state pushd uses one flat[] stack slot — account for it here so init vars
  // and loop-body vars get the correct rbp-relative offsets.
  const savedBeforePushd = context.localVarCount;

  if (useRD) {
    code += `state pushd\n`;
    context.localVarCount += 1;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  const savedAfterPushd = context.localVarCount;

  const initializer = fs.getInitializer();
  if (initializer) {
    if (initializer.isKind(SyntaxKind.VariableDeclarationList)) {
      for (const decl of (initializer as VariableDeclarationList).getDeclarations())
        code += visitVariableDeclaration(decl, context);
    } else {
      code += visitExpression(initializer, context);
    }
  }

  const initSlots = context.localVarCount - savedAfterPushd;

  // ── Condition (absent = infinite loop) ───────────────────────────────────
  const condition = fs.getCondition();
  let ifCode: string;
  if (condition) {
    const pattern = parseIfCondition(condition, context);
    if (!pattern) {
      context.localVarCount = savedBeforePushd;
      context.isInLoop = false;
      context.usingRD = useRD;
      if (useRD) code += `state popd\n`;
      return code;
    }
    const right = typeof pattern.right === 'number'
      ? `set rd ${pattern.right}\n`
      : (visitExpression(pattern.right, context) + `set rd ra\n`);
    const left = typeof pattern.left === 'number'
      ? `set rb ${pattern.left}\n`
      : (visitExpression(pattern.left, context) + `set rb ra\n`);
    ifCode = `${right}\n${left}\nset ra 1\n${pattern.op} rb rd\n  set ra 0\n`;
  } else {
    // No condition → loop forever until break
    ifCode = `set ra 0\n`;
  }

  // We deliberately avoid state pushc/popc for the for loop. The loop counter
  // lives in a local flat[] variable (init var or implicit flat slot), not in
  // rc. Skipping pushc means state popc never needs to run, so a break inside
  // the loop body cannot leave an uncleaned stack slot.
  code += ifCode + 'whilen ra 1 {\n';

  // Track the local-var baseline so we can clean up body-allocated vars.
  const savedLoopCount = context.localVarCount;

  // ── Body ──────────────────────────────────────────────────────────────────
  code += visitBlockOrStmt(fs.getStatement(), context);

  // Cleanup body locals so rsp is stable before the update + condition re-eval.
  const loopBodySlots = context.localVarCount - savedLoopCount;
  if (loopBodySlots > 0)
    code += indent(`sub rsp ${loopBodySlots}\n`, 1);

  context.localVarCount = savedLoopCount;

  // ── Update (i++, i += 1, --j, …) ─────────────────────────────────────────
  const incrementor = fs.getIncrementor();
  if (incrementor)
    code += indent(visitExpression(incrementor, context), 1);

  code += indent(ifCode, 1);
  code += '}\n';

  // ── Release init-scope variables ──────────────────────────────────────────
  if (initSlots > 0)
    code += `sub rsp ${initSlots}\n`;

  // Restore to pre-pushd count; state popd will physically remove the slot.
  context.localVarCount = savedBeforePushd;

  context.isInLoop = false;
  context.usingRD = useRD;

  if (useRD)
    code += `state popd\n`;

  return code;
}
