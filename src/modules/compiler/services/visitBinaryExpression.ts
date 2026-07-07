import { BinaryExpression, PropertyAccessExpression, PropertyAssignment, SyntaxKind } from "ts-morph";
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
    // ── Special case: actor inline-object prop assigned from an object literal ──
    // e.g. this.state = { phase: 0, timer: 0 }
    // Expands into individual field writes instead of heap-allocating an object.
    if (opText === '=' &&
        right.isKind(SyntaxKind.ObjectLiteralExpression) &&
        left.isKind(SyntaxKind.PropertyAccessExpression)) {
      const propName = (left as PropertyAccessExpression).getName();
      const pSym = context.actorCustomChildren?.[propName] as SymbolDefinition | undefined;
      if (pSym && (pSym.type & ESymbolType.object) && pSym.children) {
        for (const prop of right.asKindOrThrow(SyntaxKind.ObjectLiteralExpression).getProperties()) {
          if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;
          const pa = prop as PropertyAssignment;
          const fieldName = pa.getName();
          const childSym = pSym.children[fieldName] as SymbolDefinition | undefined;
          if (!childSym) continue;
          const fieldVal = evaluateLiteralExpression(pa.getInitializer(), context);
          const val = (typeof fieldVal !== 'undefined' && typeof fieldVal !== 'object') ? Number(fieldVal) : 'ra';
          if (val === 'ra') code += visitExpression(pa.getInitializer(), context);
          code += `set ri _pCptr\n`;
          const absOff = pSym.offset + childSym.offset;
          if (absOff !== 0) code += `add ri ${absOff}\n`;
          code += `setarray flat[ri] ${val}\n`;
        }
        return code;
      }
    }

    // assignment
    const valD = evaluateLiteralExpression(right, context);
    // evaluateLiteralExpression returns a Record for object literals — treat as
    // unresolvable so we don't call Number({...}) which produces NaN.
    const isCompileTimeScalar = typeof valD !== 'undefined' && typeof valD !== 'object';
    if (!isCompileTimeScalar)
      code += visitExpression(right, context,);

    // If right side was compile-time evaluated (curFpBits not updated), fall back to
    // the symbol's declared fp_bits so FP→int coercion still fires for const FP vars
    let rightFpBitsAssign = context.curFpBits;
    if (rightFpBitsAssign === 0 && isCompileTimeScalar && right.isKind(SyntaxKind.Identifier)) {
      const rhsSym = (context.symbolTable.get(right.getText()) ?? context.paramMap[right.getText()]) as SymbolDefinition | undefined;
      if (rhsSym?.fp_bits) rightFpBitsAssign = rhsSym.fp_bits;
    }
    // Capture right-side string/quote type before the left side load (for compound +=)
    // overwrites context.curExpr. Compile-time scalars are always numeric.
    const rightIsString = !isCompileTimeScalar && Boolean(context.curExpr & ESymbolType.string);
    const rightIsQuote  = !isCompileTimeScalar && Boolean(context.curExpr & ESymbolType.quote);

    // Track the value to use in storeLeftSideOfAssignment (may be overridden below)
    let storeVal: string | number = isCompileTimeScalar ? Number(valD) : 'ra';

    // For plain `=`: if right side is FP but left side is a plain integer, convert
    if (opText === '=' && rightFpBitsAssign !== 0) {
      const leftText = left.isKind(SyntaxKind.Identifier) ? left.getText().trim() : null;
      if (leftText) {
        const leftSym = (context.symbolTable.get(leftText) ?? context.paramMap[leftText]) as SymbolDefinition | undefined;
        if (leftSym && !leftSym.fp_bits && !(leftSym.type & ESymbolType.fixed_point)) {
          if (typeof valD === 'undefined') {
            // Runtime FP value in ra: emit shift
            code += `shiftr ra ${rightFpBitsAssign}\n`;
            // storeVal stays 'ra'
          } else {
            // Compile-time constant: convert at compile time
            storeVal = ((Number(valD) >>> rightFpBitsAssign) | 0);
          }
          context.curFpBits = 0;
        }
      }
    }

    // Detect float literal on right side for compound-assignment scaling
    const litTextAssign = right.isKind(SyntaxKind.NumericLiteral) ? right.getText() : null;
    const litIsFloatAssign = litTextAssign !== null && litTextAssign.includes('.');

    if (opText != '=') {
      // The right-side result is in ra. Loading the left side (for array/member
      // access) may evaluate an index expression into ra, clobbering it.
      // Preserve ra across the left-side load when it holds a runtime value.
      if (!isCompileTimeScalar)
        code += `state push\n`;
      code += visitExpression(left, context, 'rd');
      const leftFpBitsAssign = context.curFpBits;
      const leftIsString = Boolean(context.curExpr & ESymbolType.string);
      const leftIsQuote  = Boolean(context.curExpr & ESymbolType.quote);
      if (!isCompileTimeScalar)
        code += `state pop\n`;

      // Scale float literals to FP and compute effective right FP precision
      let effectiveRightFpBitsAssign = rightFpBitsAssign;
      let rhs: string | number;
      if (typeof valD !== 'undefined') {
        const n = Number(valD);
        if (litIsFloatAssign && leftFpBitsAssign > 0) {
          rhs = Math.round(n * (1 << leftFpBitsAssign));
          effectiveRightFpBitsAssign = leftFpBitsAssign;
        } else {
          rhs = n;
        }
      } else {
        rhs = 'ra';
      }

      switch (opText) {
        case '+=':
          if (leftIsString) {
            if (!rightIsString) {
              // Right side is numeric — convert to string first (mirrors string + number in non-compound path)
              const toStr = rightFpBitsAssign !== 0 ? `_convertFP2String` : `_convertInt2String`;
              code += `state pushr1\nset r0 ${rhs}\nstate ${toStr}\nstate popr1\n`;
              // rb now holds the converted string ptr; rd still holds the left string ptr
              code += `state pushr2\nset r0 rd\nset r1 rb\nstate _stringConcat\nstate popr2\nset rd rb\n`;
            } else {
              code += `state pushr2\nset r0 rd\nset r1 ${rhs}\nstate _stringConcat\nstate popr2\nset rd rb\n`;
            }
          } else if (leftIsQuote)
            code += `qstrcat rd ${rhs}\n`;
          else
            code += `add rd ${rhs}\n`;
          break;
        case "-=":
          code += `sub rd ${rhs}\n`;
          break;
        case "*=":
          if (leftFpBitsAssign !== 0 && effectiveRightFpBitsAssign !== 0) {
            if (leftFpBitsAssign !== effectiveRightFpBitsAssign)
              addDiagnostic(bin, context, 'warning', `FP precision mismatch in *=: FP${leftFpBitsAssign} vs FP${effectiveRightFpBitsAssign}`);
            code += `mulscale rd rd ${rhs} ${leftFpBitsAssign}\n`;
          } else {
            code += `mul rd ${rhs}\n`;
          }
          break;
        case "/=":
          if (leftFpBitsAssign !== 0 && effectiveRightFpBitsAssign !== 0) {
            if (leftFpBitsAssign !== effectiveRightFpBitsAssign)
              addDiagnostic(bin, context, 'warning', `FP precision mismatch in /=: FP${leftFpBitsAssign} vs FP${effectiveRightFpBitsAssign}`);
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

    code += storeLeftSideOfAssignment(left, context, `${opText != '=' ? 'rd' : String(storeVal)}`);
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

  // rd holds the left string/quote result. A function call on the right side
  // may clobber rd (CON defstate calls don't preserve registers). Save rd to a
  // spill slot before evaluating the right side so the string/quote concat below
  // uses the correct left ptr even after recursive calls like child.Stringify().
  let strLhsSpillRfx: string | null = null;
  let strLhsSpillStack = false;
  if ((isString || isQuote) && typeof valD === 'undefined') {
    if (context.rfxAllocated < 4) {
      strLhsSpillRfx = `rfx${context.rfxAllocated}`;
      context.rfxAllocated++;
      code += `set ${strLhsSpillRfx} rd\n`;
    } else {
      strLhsSpillStack = true;
      code += `state pushd\n`;
    }
  }

  if (typeof valD === 'undefined' || typeof valD === 'object')
    code += visitExpression(right, context);

  // Restore rd from the spill slot after right-side evaluation.
  if (strLhsSpillRfx !== null) {
    context.rfxAllocated--;
    code += `set rd ${strLhsSpillRfx}\n`;
  } else if (strLhsSpillStack) {
    code += `state popd\n`;
  }

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

  // Auto-coerce non-literal right side to match left FP precision
  let effectiveRightFpBits = rightFpBits;
  if (typeof valD === 'undefined' && rightFpBits > 0 && leftFpBits > 0 && rightFpBits !== leftFpBits) {
    if (rightFpBits > leftFpBits)
      code += `shiftr ra ${rightFpBits - leftFpBits}\n`;
    else
      code += `shiftl ra ${leftFpBits - rightFpBits}\n`;
    addDiagnostic(bin, context, 'warning',
      `Auto-coercing right FP${rightFpBits} to FP${leftFpBits} in '${opText}'`);
    effectiveRightFpBits = leftFpBits;
  }

  // Scale float literals (text contains '.') to the FP representation of the left operand
  const litText = right.isKind(SyntaxKind.NumericLiteral) ? right.getText() : null;
  const litIsFloat = litText !== null && litText.includes('.');
  let rhs: string;
  if (typeof valD !== 'undefined' && typeof valD !== 'object') {
    const n = Number(valD);
    rhs = (litIsFloat && leftFpBits > 0) ? String(Math.round(n * (1 << leftFpBits))) : String(n);
  } else {
    rhs = 'ra';
  }

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
      if (leftFpBits !== 0 && effectiveRightFpBits !== 0) {
        if (leftFpBits !== effectiveRightFpBits)
          addDiagnostic(bin, context, 'warning', `FP precision mismatch: FP${leftFpBits} * FP${effectiveRightFpBits}`);
        code += `mulscale rd rd ${rhs} ${leftFpBits}\n`;
        resultFpBits = leftFpBits;
      } else if (leftFpBits !== 0 && effectiveRightFpBits === 0) {
        code += `mul rd ${rhs}\n`;
        resultFpBits = leftFpBits;
      } else if (leftFpBits === 0 && effectiveRightFpBits !== 0) {
        addDiagnostic(bin, context, 'warning', `integer * FP${effectiveRightFpBits}: swap operands or use explicit cast`);
        code += `mul rd ${rhs}\n`;
      } else {
        code += `mul rd ${rhs}\n`;
      }
      break;
    case "/":
      if (leftFpBits !== 0 && effectiveRightFpBits !== 0) {
        if (leftFpBits !== effectiveRightFpBits)
          addDiagnostic(bin, context, 'warning', `FP precision mismatch: FP${leftFpBits} / FP${effectiveRightFpBits}`);
        code += `divscale rd rd ${rhs} ${leftFpBits}\n`;
        resultFpBits = leftFpBits;
      } else if (leftFpBits !== 0 && effectiveRightFpBits === 0) {
        code += `div rd ${rhs}\n`;
        resultFpBits = leftFpBits;
      } else if (leftFpBits === 0 && effectiveRightFpBits !== 0) {
        addDiagnostic(bin, context, 'warning', `integer / FP${effectiveRightFpBits}: cast left side to FP first`);
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
    case "??":
      // Nullish coalescing: return left if non-zero, otherwise right
      code += `set rb rd\nife rd 0 {\n  set rb ${rhs}\n}\n`;
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