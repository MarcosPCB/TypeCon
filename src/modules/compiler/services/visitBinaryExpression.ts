import { BinaryExpression } from "ts-morph";
import { CompilerContext, ESymbolType } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { evaluateLiteralExpression } from "../helper/helpers";
import { visitExpression } from "./visitExpression";
import { storeLeftSideOfAssignment } from "./storeLeftSideOfAssignment";

export function visitBinaryExpression(bin: BinaryExpression, context: CompilerContext, reg = 'ra'): string {
    const left = bin.getLeft();
    const right = bin.getRight();
    const opText = bin.getOperatorToken().getText();

    let code = context.options.lineDetail ? `/* binary: ${left.getText().trim()} ${opText} ${right.getText().trim()}*/\n` : '';

    /*const forbidden = ["<", ">", "<=", ">=", "==", "!=", "&&", "||"];
    if (forbidden.includes(opText)) {
      addDiagnostic(bin, context, "error", `Operator "${opText}" not allowed in normal expressions`);
      code += `set ra 0\n`;
      return code;
    }*/

      if(left.getText() == 'extra')
        debugger;

    const useRD = context.usingRD;
    context.usingRD = true;
    
    if (opText.includes("=") && !['>=', '<=', '=='].includes(opText)) {
      // assignment
      const valD = evaluateLiteralExpression(right);
      if(typeof valD === 'undefined')
        code += visitExpression(right, context,);

      if (opText != '=') {
        //code += `set rd ra\n`
        code += visitExpression(left, context, 'rd');

        switch (opText) {
          case '+=':
            code += `add rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
            break;
          case "-=":
            code += `sub rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
            break;
          case "*=":
            code += `mul rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
            break;
          case "/=":
            code += `div rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
            break;
          case "%=":
            code += `mod rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
            break;
          case "&=":
            code += `and rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
            break;
          case "|=":
            code += `or rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
            break;
          case "^=":
            code += `xor rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
            break;
          case ">>=":
            code += `shiftr rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
            break;
          case "<<=":
            code += `shiftl rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
            break;
        }
      } //else
        //code += `set rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;

      code += storeLeftSideOfAssignment(left, context, `${opText != '=' ? 'rd' : typeof valD !== 'undefined' ? Number(valD) : 'ra'}`);
      context.usingRD = useRD;

      return code;
    }

    if(useRD)
      code += `state pushd\n`;
    code +=  context.options.lineDetail ? `// left side\n` : '';
    code += visitExpression(left, context, 'rd');

    const isQuote = Boolean(context.curExpr & ESymbolType.quote);
    const isString = Boolean(context.curExpr & ESymbolType.string);

    if (isQuote && opText != '+') {
      addDiagnostic(bin, context, "error", `Unhandled operator for string expression "${opText}"`);
      code += `set ra 0\n`;
    }

    //code += `set rd ra\n`;
    code += context.options.lineDetail ? `// right side\n` : '';
    const valD = evaluateLiteralExpression(right);

    if(typeof valD === 'undefined')
      code += visitExpression(right, context);

    if (isQuote && !(context.curExpr & ESymbolType.quote))
      code += `qputs 1022 %d\nqsprintf 1023 1022 ra\nset ra 1022\n`;

    if (isString && !(context.curExpr & ESymbolType.string))
      code += `state pushr1\nset r0 ra\nstate _convertInt2String\nstate popr1\nset ra rb\n`

    context.curExpr = isQuote ? ESymbolType.quote : ESymbolType.number;
    context.curExpr = isString ? ESymbolType.string : ESymbolType.number;

    switch (opText) {
      case "+":
        if (isQuote)
          code += `qstrcat rd ra\n`;
        else if (isString)
          code += `state pushr2\nset r0 rd\nset r1 ra\nstate _stringConcat\nstate popr2\nset ra rb\n`;
        else
          code += `add rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
        break;
      case "-":
        code += `sub rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
        break;
      case "*":
        code += `mul rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
        break;
      case "/":
        code += `div rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
        break;
      case "%":
        code += `mod rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
        break;
      case "&":
        code += `and rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
        break;
      case "|":
        code += `or rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
        break;
      case "^":
        code += `xor rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
        break;
      case ">>":
        code += `shiftr rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
        break;
      case "<<":
        code += `shiftl rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n`;
        break;
      case "<":
        code += `set rb 0\nifl rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n  set rb 1\n`;
        break;
      case "<=":
        code += `set rb 0\nifle rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n  set rb 1\n`;
        break;
      case ">":
        code += `set rb 0\nifg rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n  set rb 1\n`;
        break;
      case ">=":
        code += `set rb 0\nifge rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n  set rb 1\n`;
        break;
      case "==":
        code += `set rb 0\nife rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n  set rb 1\n`;
        break;
      case "!=":
        code += `set rb 0\nifn rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n  set rb 1\n`;
        break;
      case "&&":
        code += `set rb 0\nifand rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n  set rb 1\n`;
        break;
      case "||":
        code += `set rb 0\nifeither rd ${typeof valD !== 'undefined' ? Number(valD) : 'ra'}\n  set rb 1\n`;
        break;
      default:
        addDiagnostic(bin, context, "error", `Unhandled operator "${opText}"`);
        code += `set ra 0\n`;
    }

    switch(opText) {
      case "+":
      case "-":
      case "*":
      case "/":
      case "%":
      case "&":
      case "|":
      case "^":
        if(reg != 'rd')
          code += `set ${reg} rd\n`;
        break;
      
      default:
        if(reg != 'rb')
          code += `set ${reg} rb\n`;
        break;
    }

    if(useRD && reg != 'rd')
      code += `state popd\n`;

    context.usingRD = useRD;

    return code;
  }