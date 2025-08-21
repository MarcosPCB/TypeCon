import { Expression, PrefixUnaryExpression, SyntaxKind, PostfixUnaryExpression } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { visitExpression } from "./visitExpression";

export function visitUnaryExpression(expr: Expression, context: CompilerContext, reg = 'ra'): string {
    let code = context.options.lineDetail ? `// unary: ${expr.getText()}\n` : '';
    if (expr.isKind(SyntaxKind.PrefixUnaryExpression)) {
      const pre = expr as PrefixUnaryExpression;
      code += visitExpression(pre.getOperand(), context, reg);
      switch (pre.getOperatorToken()) {
        case SyntaxKind.PlusPlusToken:
          code += `add ${reg} 1\n`;
          break;
        case SyntaxKind.MinusMinusToken:
          code += `sub ${reg} 1\n`;
          break;
        case SyntaxKind.MinusToken:
          code += `inv ${reg}\n`;
          break;
        case SyntaxKind.ExclamationToken:
          //addDiagnostic(expr, context, "error", `"!" not allowed in normal expressions (only if patterns)`);
          if(reg != 'rb')
            code += `set rb ${reg}\n`;

          code += `clamp rb 0 1\n`
          break;
        default:
          addDiagnostic(expr, context, "error", `Unhandled prefix op`);
          code += `set ra 0\n`;
      }
      code += `setarray flat[ri] ${reg}\n`;
      return code;
    } else if (expr.isKind(SyntaxKind.PostfixUnaryExpression)) {
      const post = expr as PostfixUnaryExpression;
      code += visitExpression(post.getOperand(), context, reg);
      switch (post.getOperatorToken()) {
        case SyntaxKind.PlusPlusToken:
          code += `add ${reg} 1\n`;
          break;
        case SyntaxKind.MinusMinusToken:
          code += `sub ${reg} 1\n`;
          break;
        default:
          addDiagnostic(expr, context, "error", `Unhandled postfix op`);
          code += `set ra 0\n`;
      }
      code += `setarray flat[ri] ${reg}\n`;
      return code;
    }
    return code;
  }