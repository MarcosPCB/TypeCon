import { 
    SyntaxKind, 
    VariableDeclaration, 
    PropertyAssignment, 
    Expression,
    BinaryExpression,
    CallExpression,
    PropertyAccessExpression,
    NumericLiteral,
    PrefixUnaryExpression,
    Project,
    Node,
    ObjectLiteralExpression,
    ElementAccessExpression,
    Identifier,
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

  /**
 * Recursively constant-folds an Expression to:
 *  - number             for numeric / enum members, or
 *  - Record<string,any> for plain-object “enums”
 *  - undefined          if not fully constant
 */
export function evaluateLiteralExpression(
  node: Expression
): number | Record<string, any> | undefined {
  // --- 1) Plain numeric literal ---
  if (Node.isNumericLiteral(node)) {
    return parseFloat(node.getText());
  }

  // --- 2) Prefix unary (+, -, ~) ---
  if (Node.isPrefixUnaryExpression(node)) {
    const v = evaluateLiteralExpression(node.getOperand());
    if (typeof v !== "number") return;
    switch (node.getOperatorToken()) {
      case SyntaxKind.PlusToken:  return +v;
      case SyntaxKind.MinusToken: return -v;
      case SyntaxKind.TildeToken: return ~v;
      default:                    return;
    }
  }

  // --- 3) Binary ops (+, -, *, /, %, <<, >>, >>>, &, |, ^) ---
  if (Node.isBinaryExpression(node)) {
    const L = evaluateLiteralExpression(node.getLeft());
    const R = evaluateLiteralExpression(node.getRight());
    if (typeof L !== "number" || typeof R !== "number") return;
    switch (node.getOperatorToken().getKind()) {
      case SyntaxKind.PlusToken:    return L + R;
      case SyntaxKind.MinusToken:   return L - R;
      case SyntaxKind.AsteriskToken:return L * R;
      case SyntaxKind.SlashToken:   return L / R;
      case SyntaxKind.PercentToken: return L % R;
      case SyntaxKind.LessThanLessThanToken:          return L << R;
      case SyntaxKind.GreaterThanGreaterThanToken:    return L >> R;
      case SyntaxKind.GreaterThanGreaterThanGreaterThanToken: return L >>> R;
      case SyntaxKind.AmpersandToken: return L & R;
      case SyntaxKind.BarToken:       return L | R;
      case SyntaxKind.CaretToken:     return L ^ R;
      default:                        return;
    }
  }

  // --- 4) Object-literal “enum” ---
  if (Node.isObjectLiteralExpression(node)) {
    const obj: Record<string, any> = {};
    for (const prop of node.getProperties()) {
      if (Node.isPropertyAssignment(prop) && Node.isIdentifier(prop.getNameNode())) {
        const key = prop.getNameNode().getText();
        const val = evaluateLiteralExpression(prop.getInitializer()!);
        if (val === undefined) return;
        obj[key] = val;
      } else {
        // we’re not handling spreads, methods, etc.
        return;
      }
    }
    return obj;
  }

  // --- 5) PropertyAccess (nested-object or real enum) ---
  if (Node.isPropertyAccessExpression(node)) {
    // a) first try nested-object lookup
    const leftVal = evaluateLiteralExpression(node.getExpression());
    if (leftVal && typeof leftVal === "object") {
      const key = node.getName();
      if (key in leftVal) return leftVal[key];
    }

    // b) else try TS enum member
    const sym = node.getSymbol();
    if (sym) {
      const decl = sym.getDeclarations().find(Node.isEnumMember);
      if (decl) {
        return Number(decl.getValue());  // ts-morph helper for the computed enum value
      }
    }
    return;
  }

  // --- 6) ElementAccess (obj['A']) for plain-object enums ---
  if (Node.isElementAccessExpression(node)) {
    const arg = node.getArgumentExpression();
    if (arg && Node.isStringLiteral(arg)) {
      const L = evaluateLiteralExpression(node.getExpression());
      if (L && typeof L === "object") {
        return (L as any)[arg.getLiteralValue()];
      }
    }
  }

  // --- 7) Identifier (const-enum in same file) ---
  if (Node.isIdentifier(node)) {
    const sym = node.getSymbol();
    if (sym) {
      const decl = sym.getDeclarations().find(Node.isEnumMember);
      if (decl) {
        return Number(decl.getValue());
      }
    }
  }

  // not something we can fold
  return;
}

  export function findNativeFunction(fnName: string, obj?: string, type?: string): CON_NATIVE_FUNCTION | undefined {
    // Remove "this." prefix if it exists.
    const cleanName = fnName.startsWith("this.") ? fnName.substring(5) : fnName;
    return nativeFunctions.find(nf => (nf.name == cleanName && ((obj && nf.object_belong && nf.object_belong.includes(obj) || (obj && type && nf.type_belong && nf.type_belong.includes(type))) || !obj)));
  }

  export function findNativeVar_Sprite(propName: string): CON_NATIVE_VAR | undefined {
    return nativeVars_Sprites.find(v => v.name === propName);
  }
  
  