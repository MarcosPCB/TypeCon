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
  import { TranspilerContext, addDiagnostic } from '../services/Transpiler2'
  // The line above is hypothetical; adapt to your actual imports.
  
  import { CON_NATIVE_FUNCTION, CON_NATIVE_VAR, EMoveFlags, nativeFunctions, nativeVars_Sprites } from "../../../defs/TCSet100/native"; 
  // Or wherever EMoveFlags is declared
  
  /**
   * Evaluate an expression that’s expected to produce a numeric "flags" value,
   * e.g. EMoveFlags.faceplayer | EMoveFlags.randomangle,
   * disallowing call expressions and other unsupported constructs.
   */
  export function evalMoveFlags(expr: Expression, context: TranspilerContext): number {
    switch (expr.getKind()) {
      // A direct numeric literal => parse
      case SyntaxKind.NumericLiteral:
        return parseInt((expr as NumericLiteral).getText(), 10);
  
      // A call expression => error
      case SyntaxKind.CallExpression:
        addDiagnostic(expr, context, "error", "Call expressions not allowed in IAi.flags");
        return 0;
  
      // Possibly a property like EMoveFlags.faceplayer
      case SyntaxKind.PropertyAccessExpression: {
        const pae = expr as PropertyAccessExpression;
        const leftText = pae.getExpression().getText();
        const rightText = pae.getName();
        // e.g. leftText === "EMoveFlags", rightText === "faceplayer"
        if (leftText === "EMoveFlags") {
          // Resolve it from the EMoveFlags enum
          const enumValue = (EMoveFlags as any)[rightText];
          if (typeof enumValue === "number") {
            return enumValue;
          } else {
            addDiagnostic(expr, context, "error", `Unknown EMoveFlags member: ${rightText}`);
            return 0;
          }
        } else {
          // e.g. someObject.someProp => not supported if we only want EMoveFlags
          addDiagnostic(expr, context, "error", `Unsupported property access in IAi.flags: ${expr.getText()}`);
          return 0;
        }
      }
  
      // A unary expression? e.g. + or - something
      case SyntaxKind.PrefixUnaryExpression: {
        const pre = expr as PrefixUnaryExpression;
        const op = pre.getOperatorToken();
        const operandValue = evalMoveFlags(pre.getOperand(), context);
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
        const leftVal = evalMoveFlags(bin.getLeft(), context);
        const rightVal = evalMoveFlags(bin.getRight(), context);
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

  export function findNativeFunction(fnName: string): CON_NATIVE_FUNCTION | undefined {
    // Remove "this." prefix if it exists.
    const cleanName = fnName.startsWith("this.") ? fnName.substring(5) : fnName;
    return nativeFunctions.find(nf => nf.name === cleanName);
  }

  export function findNativeVar_Sprite(propName: string): CON_NATIVE_VAR | undefined {
    return nativeVars_Sprites.find(v => v.name === propName);
  }
  
  