import { ForOfStatement, SyntaxKind, VariableDeclarationList } from "ts-morph";
import { CompilerContext, ESymbolType } from "../Compiler";
import { indent } from "../helper/indent";
import { visitExpression } from "./visitExpression";
import { visitBlockOrStmt } from "./visitBlockOrStmt";
import { formatLineDetail } from "../helper/formatLineDetail";
import { addDiagnostic } from "./addDiagnostic";

export function visitForOfStatement(fos: ForOfStatement, context: CompilerContext): string {
  let code = context.options.lineDetail ? formatLineDetail(fos.getText()) : '';

  if (fos.isAwaited()) {
    addDiagnostic(fos, context, 'error', 'for await...of is not supported in TypeCON.');
    return code;
  }

  // ── Resolve loop variable ─────────────────────────────────────────────────
  const init = fos.getInitializer();
  if (!init || !init.isKind(SyntaxKind.VariableDeclarationList)) {
    addDiagnostic(fos, context, 'error', 'for...of initializer must be a variable declaration (e.g. const x of arr).');
    return code;
  }
  const decl = (init as VariableDeclarationList).getDeclarations()[0];
  if (!decl) {
    addDiagnostic(fos, context, 'error', 'for...of requires a declared loop variable.');
    return code;
  }
  const loopVarName = decl.getName();

  context.isInLoop = true;

  const useRD = context.usingRD;
  context.usingRD = true;

  // Save localVarCount BEFORE pushd so it can be fully restored after popd.
  // state pushd uses one flat[] stack slot — account for it here so all
  // hidden slots and the loop variable get correct rbp-relative offsets.
  const savedBeforePushd = context.localVarCount;

  if (useRD) {
    code += `state pushd\n`;
    context.localVarCount += 1;
  }

  // ── Evaluate iterable → ra (heap array pointer) ───────────────────────────
  code += visitExpression(fos.getExpression(), context);
  const iterableType = context.curExpr;
  const iterableChildren = context.curSymRet;

  // ── Hidden slot: __ptr__ (array pointer) ──────────────────────────────────
  const ptrOffset = context.localVarCount;
  code += `add rsp 1\nsetarray flat[rsp] ra\n`;
  context.localVarCount++;

  // ── Hidden slot: __ctr__ (counter 0 … length-1) ──────────────────────────
  const ctrOffset = context.localVarCount;
  code += `add rsp 1\nsetarray flat[rsp] 0\n`;
  context.localVarCount++;

  // ── Declared loop variable (added to symbol table) ────────────────────────
  const itemOffset = context.localVarCount;
  code += `add rsp 1\nsetarray flat[rsp] 0\n`;
  const elemType = (iterableType & ~ESymbolType.array) || ESymbolType.number;
  context.symbolTable.set(loopVarName, {
    name: loopVarName,
    type: elemType,
    offset: itemOffset,
    size: 1,
    global: false,
    parentFunc: context.curFunc?.name,
    children: iterableChildren?.children,
    class_name: (elemType & ESymbolType.class) ? iterableChildren?.name : undefined,
  });
  context.localVarCount++;

  const allocatedSlots = context.localVarCount - savedBeforePushd - (useRD ? 1 : 0); // = 3

  // ── Condition: counter < flat[ptr]  (array length) ───────────────────────
  //   rd = length,  rb = counter
  const condCode =
    `set ri rbp\nadd ri ${ptrOffset}\nset rd flat[ri]\n` + // rd = ptr value
    `set ri rd\nset rd flat[ri]\n` +                       // rd = array length
    `set ri rbp\nadd ri ${ctrOffset}\nset rb flat[ri]\n` + // rb = counter
    `set ra 1\nifl rb rd\n  set ra 0\n`;

  // No state pushc/popc — the counter lives in flat[rbp+ctrOffset], not in rc.
  // This avoids break leaving an uncleaned pushc slot on the stack.
  code += condCode + 'whilen ra 1 {\n';

  // ── Load loop variable: item = flat[ptr + 1 + ctr] ───────────────────────
  const loadItem =
    `set ri rbp\nadd ri ${ptrOffset}\nset rd flat[ri]\n` + // rd = ptr value
    `add rd 1\n` +                                          // rd = ptr + 1
    `set ri rbp\nadd ri ${ctrOffset}\nadd rd flat[ri]\n` + // rd = ptr + 1 + ctr
    `set ri rd\nset ra flat[ri]\n` +                        // ra = element
    `set ri rbp\nadd ri ${itemOffset}\nsetarray flat[ri] ra\n`; // item = element

  code += indent(loadItem, 1);

  // Track the local-var baseline for body cleanup.
  const savedLoopCount = context.localVarCount;

  // ── Body ──────────────────────────────────────────────────────────────────
  code += visitBlockOrStmt(fos.getStatement(), context);

  // Cleanup body locals
  const loopBodySlots = context.localVarCount - savedLoopCount;
  if (loopBodySlots > 0)
    code += indent(`sub rsp ${loopBodySlots}\n`, 1);

  context.localVarCount = savedLoopCount;

  // ── Increment counter ─────────────────────────────────────────────────────
  const incrCtr =
    `set ri rbp\nadd ri ${ctrOffset}\n` +
    `set ra flat[ri]\nadd ra 1\nsetarray flat[ri] ra\n`;

  code += indent(incrCtr, 1);

  // ── Condition re-eval ─────────────────────────────────────────────────────
  code += indent(condCode, 1);
  code += '}\n';

  // ── Release init slots (ptr + ctr + item) ────────────────────────────────
  code += `sub rsp ${allocatedSlots}\n`;

  // Restore to pre-pushd count; state popd will physically remove the slot.
  context.localVarCount = savedBeforePushd;

  context.isInLoop = false;
  context.usingRD = useRD;

  if (useRD)
    code += `state popd\n`;

  return code;
}
