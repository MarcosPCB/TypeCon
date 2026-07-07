import { Expression, PrefixUnaryExpression, SyntaxKind, PostfixUnaryExpression } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { visitExpression } from "./visitExpression";
import { storeLeftSideOfAssignment } from "./storeLeftSideOfAssignment";
import { formatLineDetail } from "../helper/formatLineDetail";

export function visitUnaryExpression(expr: Expression, context: CompilerContext, reg = 'ra'): string {
  let code = context.options.lineDetail ? formatLineDetail(`unary: ${expr.getText()}`) : '';
  if (expr.isKind(SyntaxKind.PrefixUnaryExpression)) {
    const pre = expr as PrefixUnaryExpression;
    code += visitExpression(pre.getOperand(), context, reg);
    switch (pre.getOperatorToken()) {
      case SyntaxKind.PlusPlusToken:
        code += `add ${reg} 1\n`;
        code += storeLeftSideOfAssignment(pre.getOperand(), context, reg);
        break;
      case SyntaxKind.MinusMinusToken:
        code += `sub ${reg} 1\n`;
        code += storeLeftSideOfAssignment(pre.getOperand(), context, reg);
        break;
      case SyntaxKind.MinusToken:
        code += `inv ${reg}\n`;
        break;
      case SyntaxKind.TildeToken:
        code += `xor ${reg} -1\n`;
        break;
      case SyntaxKind.ExclamationToken:
        //addDiagnostic(expr, context, "error", `"!" not allowed in normal expressions (only if patterns)`);
        code += `ifge ${reg} 1\n  set ${reg} 0\nelse ifle ${reg} 0\n  set ${reg} 1\n`
        break;
      default:
        addDiagnostic(expr, context, "error", `Unhandled prefix op`);
        code += `set ra 0\n`;
    }
    return code;
  } else if (expr.isKind(SyntaxKind.PostfixUnaryExpression)) {
    const post = expr as PostfixUnaryExpression;
    code += visitExpression(post.getOperand(), context, reg);
    switch (post.getOperatorToken()) {
      case SyntaxKind.PlusPlusToken:
        // Postfix: return OLD value; new value written to memory.
        // reg='ra': save old on stack, increment and write, restore old.
        // reg!='ra': use ra as scratch for new value; reg (e.g. 'rd') is untouched by storeLeftSideOfAssignment.
        if (reg === 'ra') {
          code += `state push\nadd ra 1\n`;
          code += storeLeftSideOfAssignment(post.getOperand(), context, 'ra');
          code += `state pop\n`;
        } else {
          code += `set ra ${reg}\nadd ra 1\n`;
          code += storeLeftSideOfAssignment(post.getOperand(), context, 'ra');
        }
        break;
      case SyntaxKind.MinusMinusToken:
        if (reg === 'ra') {
          code += `state push\nsub ra 1\n`;
          code += storeLeftSideOfAssignment(post.getOperand(), context, 'ra');
          code += `state pop\n`;
        } else {
          code += `set ra ${reg}\nsub ra 1\n`;
          code += storeLeftSideOfAssignment(post.getOperand(), context, 'ra');
        }
        break;
      default:
        addDiagnostic(expr, context, "error", `Unhandled postfix op`);
        code += `set ra 0\n`;
    }
    return code;
  }
  return code;
}