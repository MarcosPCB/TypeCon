import { 
    SyntaxKind, 
    VariableDeclaration, 
    ObjectLiteralExpression, 
    PropertyAssignment, 
    Expression,
    BinaryExpression,
    CallExpression,
    PropertyAccessExpression,
    NumericLiteral,
    PrefixUnaryExpression
  } from "ts-morph";
  import { CompilerContext, addDiagnostic } from '../services/Compiler'
  // The line above is hypothetical; adapt to your actual imports.
  
  import { CON_NATIVE_FUNCTION, CON_NATIVE_VAR, EMoveFlags, nativeFunctions, nativeVars_Sprites } from "../../../sets/TCSet100/native"; 
  // Or wherever EMoveFlags is declared
  
  /**
   * Evaluate an expression that’s expected to produce a numeric "flags" value,
   * e.g. EMoveFlags.faceplayer | EMoveFlags.randomangle,
   * disallowing call expressions and other unsupported constructs.
   */
  export function evalLiteral(expr: Expression, context: CompilerContext): number {
    switch (expr.getKind()) {
      // A direct numeric literal => parse
      case SyntaxKind.NumericLiteral:
        return parseInt((expr as NumericLiteral).getText(), 10);
  
      // A call expression => error
      case SyntaxKind.CallExpression:
        addDiagnostic(expr, context, "error", "Call expressions not allowed in this statement");
        return 0;
  
      // Possibly a property like EMoveFlags.faceplayer
      case SyntaxKind.PropertyAccessExpression: {
        const pae = expr as PropertyAccessExpression;
        const leftText = pae.getExpression().getText();
        const rightText = pae.getName();
        // e.g. leftText === "EMoveFlags", rightText === "faceplayer"
        switch(leftText) {
          case "EMoveFlags": 
            return EMoveFlags[rightText];
          
          default:
            // e.g. someObject.someProp => not supported if we only want EMoveFlags
            addDiagnostic(expr, context, "error", `Unsupported property access in IAi.flags: ${expr.getText()}`);
            return 0;
        }
      }
  
      // A unary expression? e.g. + or - something
      case SyntaxKind.PrefixUnaryExpression: {
        const pre = expr as PrefixUnaryExpression;
        const op = pre.getOperatorToken();
        const operandValue = evalLiteral(pre.getOperand(), context);
        switch (op) {
          case SyntaxKind.MinusToken:
            return -operandValue;
          case SyntaxKind.PlusToken:
            return +operandValue; // typically the same as operandValue
          default:
            addDiagnostic(expr, context, "error", `Unsupported unary operator in IAi.flags: ${op}`);
            return 0;
        }
      }
  
      // A binary expression => handle |, &, ^, +, etc. if you want
      case SyntaxKind.BinaryExpression: {
        const bin = expr as BinaryExpression;
        const leftVal = evalLiteral(bin.getLeft(), context);
        const rightVal = evalLiteral(bin.getRight(), context);
        const op = bin.getOperatorToken().getText();
        switch (op) {
          case "|":
            return leftVal | rightVal;
          case "&":
            return leftVal & rightVal;
          case "^":
            return leftVal ^ rightVal;
          case "+":
            return leftVal + rightVal;
          case "-":
            return leftVal - rightVal;
          case "*":
            return leftVal * rightVal;
          case "/":
            // integer division? up to you
            return Math.floor(leftVal / rightVal);
          default:
            addDiagnostic(expr, context, "error", `Unsupported binary operator in IAi.flags: ${op}`);
            return 0;
        }
      }
  
      default:
        addDiagnostic(expr, context, "error", `Unsupported expression in IAi.flags: ${expr.getKindName()}`);
        return 0;
    }
  }

  export function findNativeFunction(fnName: string, obj?: string, type?: string): CON_NATIVE_FUNCTION | undefined {
    // Remove "this." prefix if it exists.
    const cleanName = fnName.startsWith("this.") ? fnName.substring(5) : fnName;
    return nativeFunctions.find(nf => (nf.name == cleanName && ((obj && nf.object_belong && nf.object_belong.includes(obj) || (obj && type && nf.type_belong && nf.type_belong.includes(type))) || !obj)));
  }

  export function findNativeVar_Sprite(propName: string): CON_NATIVE_VAR | undefined {
    return nativeVars_Sprites.find(v => v.name === propName);
  }
  
  