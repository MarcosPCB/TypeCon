import { BinaryExpression, SyntaxKind } from "ts-morph";
import { CompilerContext, ESymbolType, SymbolDefinition } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { evaluateLiteralExpression } from "../helper/helpers";
import { visitExpression } from "./visitExpression";
import { storeLeftSideOfAssignment } from "./storeLeftSideOfAssignment";
import { formatLineDetail } from "../helper/formatLineDetail";

export function visitBinaryExpression(bin: BinaryExpression, context: CompilerContext, reg = 'ra'): string {
  const left = bin.getLeft();
  const right = bin.getRight();
  const opText = bin.getOperatorToken().getText();

  let code = context.options.lineDetail ? formatLineDetail(`binary: ${left.getText().trim()} ${opText} ${right.getText().trim()}`) : '';

  /*const forbidden = ["<", ">", "<=", ">=", "==", "!=", "&&", "||"];
  if (forbidden.includes(opText)) {
    addDiagnostic(bin, context, "error", `Operator "${opText}" not allowed in normal expressions`);
    code += `set ra 0\n`;
    return code;
  }*/

  if (left.getText() == 'extra')
    debugger;

  const useRD = context.usingRD;

  if (opText.includes("=") && !['>=', '<=', '=='].includes(opText)) {
    // assignment
    const valD = evaluateLiteralExpression(right, context);
    if (typeof valD === 'undefined')
      code += visitExpression(right, context,);

    const rightFpBitsAssign = context.curFpBits;

    // For plain `=`: if right side is FP but left side is a plain integer, truncate
    if (opText === '=' && rightFpBitsAssign !== 0 && typeof valD === 'undefined') {
      const leftText = left.isKind(SyntaxKind.Identifier) ? left.getText().trim() : null;
      if (leftText) {
        const leftSym = (context.symbolTable.get(leftText) ?? context.paramMap[leftText]) as SymbolDefinition | undefined;
        if (leftSym && !leftSym.fp_bits && !(leftSym.type & ESymbolType.fixed_point)) {
          code += `shiftr ra ${rightFpBitsAssign}\n`;
          context.curFpBits = 0;
        }
      }
    }

    if (opText != '=') {
      //code += `set rd ra\n`
      code += visitExpression(left, context, 'rd');
      const leftFpBitsAssign = context.curFpBits;
      const rhs = typeof valD !== 'undefined' ? Number(valD) : 'ra';

      switch (opText) {
        case '+=':
          code += `add rd ${rhs}\n`;
          break;
        case "-=":
          code += `sub rd ${rhs}\n`;
          break;
        case "*=":
          if (leftFpBitsAssign !== 0 && rightFpBitsAssign !== 0) {
            if (leftFpBitsAssign !== rightFpBitsAssign)
              addDiagnostic(bin, context, 'warning', `FP precision mismatch in *=: FP${leftFpBitsAssign} vs FP${rightFpBitsAssign}`);
            code += `mulscale rd rd ${rhs} ${leftFpBitsAssign}\n`;
          } else {
            code += `mul rd ${rhs}\n`;
          }
          break;
        case "/=":
          if (leftFpBitsAssign !== 0 && rightFpBitsAssign !== 0) {
            if (leftFpBitsAssign !== rightFpBitsAssign)
              addDiagnostic(bin, context, 'warning', `FP precision mismatch in /=: FP${leftFpBitsAssign} vs FP${rightFpBitsAssign}`);
            code += `divscale rd rd ${rhs} ${leftFpBitsAssign}\n`;
          } else {
            code += `div rd ${rhs}\n`;
          }
          break;
        case "%=":
          code += `mod rd ${rhs}\n`;
          break;
        case "&=":
          code += `and rd ${rhs}\n`;
          break;
        case "|=":
          code += `or rd ${rhs}\n`;
          break;
        case "^=":
          code += `xor rd ${rhs}\n`;
          break;
        case ">>=":
          code += `shiftr rd ${rhs}\n`;
          break;
        case "<<=":
          code += `shiftl rd ${rhs}\n`;
          break;
      }
    }

    code += storeLeftSideOfAssignment(left, context, `${opText != '=' ? 'rd' : typeof valD !== 'undefined' ? Number(valD) : 'ra'}`);
    context.usingRD = useRD;

    return code;
  }

  // ── save the outer rd value (only exists when an outer binary already computed
  //    its left side) then free rd so the left-side sub-expression can use it ──
  let rfxSave: string | null = null;
  if (useRD) {
    if (context.rfxAllocated < 4) {
      rfxSave = `rfx${context.rfxAllocated}`;
      context.rfxAllocated++;
      code += `set ${rfxSave} rd\n`;
    } else {
      code += `state pushd\n`;
    }
  }
  // Left side: rd is free (outer value saved above); don't let inner exprs save unnecessarily
  context.usingRD = false;

  code += context.options.lineDetail ? `// left side\n` : '';
  code += visitExpression(left, context, 'rd');

  // Left side result is now in rd — mark it as occupied for the right-side visit
  context.usingRD = true;

  const leftFpBits = context.curFpBits;
  const isQuote = Boolean(context.curExpr & ESymbolType.quote);
  const isString = Boolean(context.curExpr & ESymbolType.string);

  if (isQuote && opText != '+') {
    addDiagnostic(bin, context, "error", `Unhandled operator for string expression "${opText}"`);
    code += `set ra 0\n`;
  }

  code += context.options.lineDetail ? `// right side\n` : '';
  const valD = evaluateLiteralExpression(right, context);

  if (typeof valD === 'undefined')
    code += visitExpression(right, context);

  const rightFpBits = context.curFpBits;

  if (isQuote && !(context.curExpr & ESymbolType.quote)) {
    if (rightFpBits !== 0)
      code += `state pushr2\nset r0 ra\nstate _convertFP2String\nset r0 rb\nstate _convertString2Quote\nstate popr2\nset ra rb\n`;
    else
      code += `qputs 1022 %d\nqsprintf 1023 1022 ra\nset ra 1022\n`;
  }

  if (isString && !(context.curExpr & ESymbolType.string)) {
    const toStr = rightFpBits !== 0 ? `_convertFP2String` : `_convertInt2String`;
    code += `state pushr1\nset r0 ra\nstate ${toStr}\nstate popr1\nset ra rb\n`;
  }

  context.curExpr = isQuote ? ESymbolType.quote : ESymbolType.number;
  context.curExpr = isString ? ESymbolType.string : ESymbolType.number;

  // Track result FP precision
  let resultFpBits: 0 | 11 | 14 | 16 | 30 = 0;

  const rhs = typeof valD !== 'undefined' ? String(Number(valD)) : 'ra';

  switch (opText) {
    case "+":
      if (isQuote)
        code += `qstrcat rd ra\n`;
      else if (isString)
        code += `state pushr2\nset r0 rd\nset r1 ra\nstate _stringConcat\nstate popr2\nset rd rb\n`;
      else
        code += `add rd ${rhs}\n`;
      resultFpBits = leftFpBits;
      break;
    case "-":
      code += `sub rd ${rhs}\n`;
      resultFpBits = leftFpBits;
      break;
    case "*":
      if (leftFpBits !== 0 && rightFpBits !== 0) {
        if (leftFpBits !== rightFpBits)
          addDiagnostic(bin, context, 'error', `FP precision mismatch: FP${leftFpBits} * FP${rightFpBits} — convert explicitly`);
        code += `mulscale rd rd ${rhs} ${leftFpBits}\n`;
        resultFpBits = leftFpBits;
      } else if (leftFpBits !== 0 && rightFpBits === 0) {
        code += `mul rd ${rhs}\n`;
        resultFpBits = leftFpBits;
      } else if (leftFpBits === 0 && rightFpBits !== 0) {
        addDiagnostic(bin, context, 'error', `integer * FP${rightFpBits}: swap operands or cast left side to FP`);
        code += `mul rd ${rhs}\n`;
      } else {
        code += `mul rd ${rhs}\n`;
      }
      break;
    case "/":
      if (leftFpBits !== 0 && rightFpBits !== 0) {
        if (leftFpBits !== rightFpBits)
          addDiagnostic(bin, context, 'error', `FP precision mismatch: FP${leftFpBits} / FP${rightFpBits} — convert explicitly`);
        code += `divscale rd rd ${rhs} ${leftFpBits}\n`;
        resultFpBits = leftFpBits;
      } else if (leftFpBits !== 0 && rightFpBits === 0) {
        code += `div rd ${rhs}\n`;
        resultFpBits = leftFpBits;
      } else if (leftFpBits === 0 && rightFpBits !== 0) {
        addDiagnostic(bin, context, 'error', `integer / FP${rightFpBits}: cast left side to FP first`);
        code += `div rd ${rhs}\n`;
      } else {
        code += `div rd ${rhs}\n`;
      }
      break;
    case "%":
      code += `mod rd ${rhs}\n`;
      break;
    case "&":
      code += `and rd ${rhs}\n`;
      break;
    case "|":
      code += `or rd ${rhs}\n`;
      break;
    case "^":
      code += `xor rd ${rhs}\n`;
      break;
    case ">>":
      code += `shiftr rd ${rhs}\n`;
      break;
    case "<<":
      code += `shiftl rd ${rhs}\n`;
      break;
    case "<":
      code += `set rb 0\nifl rd ${rhs}\n  set rb 1\n`;
      break;
    case "<=":
      code += `set rb 0\nifle rd ${rhs}\n  set rb 1\n`;
      break;
    case ">":
      code += `set rb 0\nifg rd ${rhs}\n  set rb 1\n`;
      break;
    case ">=":
      code += `set rb 0\nifge rd ${rhs}\n  set rb 1\n`;
      break;
    case "==":
      code += `set rb 0\nife rd ${rhs}\n  set rb 1\n`;
      break;
    case "!=":
      code += `set rb 0\nifn rd ${rhs}\n  set rb 1\n`;
      break;
    case "&&":
      code += `set rb 0\nifand rd ${rhs}\n  set rb 1\n`;
      break;
    case "||":
      code += `set rb 0\nifeither rd ${rhs}\n  set rb 1\n`;
      break;
    default:
      addDiagnostic(bin, context, "error", `Unhandled operator "${opText}"`);
      code += `set ra 0\n`;
  }

  context.curFpBits = resultFpBits;

  switch (opText) {
    case "+":
    case "-":
    case "*":
    case "/":
    case "%":
    case "&":
    case "|":
    case "^":
    case ">>":
    case "<<":
      if (reg != 'rd')
        code += `set ${reg} rd\n`;
      break;

    default:
      if (reg != 'rb')
        code += `set ${reg} rb\n`;
      break;
  }

  if (rfxSave) {
    context.rfxAllocated--;
    if (reg !== 'rd')
      code += `set rd ${rfxSave}\n`;
  } else if (useRD && reg != 'rd') {
    code += `state popd\n`;
  }

  context.usingRD = useRD;

  return code;
}