import { ReturnStatement } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { visitExpression } from "./visitExpression";

/******************************************************************************
   * return => evaluate => set rb ra
   *****************************************************************************/
export function visitReturnStatement(rs: ReturnStatement, context: CompilerContext): string {
    let code = "";
    const expr = rs.getExpression();
    if (expr) {
      code += visitExpression(expr, context, 'rb');
    } else {
      code += `set rb 0\n`;
    }

    if (context.mainBFunc) {
      code += `set rbp rbbp\nsub rbp 1\nset rsp rbp\nset rssp rsbp\nstate pop\nset rsbp ra\nstate pop\nset rbp ra\n`;
      code += `break\n`
    } else if (context.isInSubFunction) {
       code += `sub rbp 1\nset rsp rbp\nstate pop\nset rbp ra\nstate pop\nset rd 0\njump ra\n\n`;
    } else {
      code += `sub rbp 1\nset rsp rbp\n\nstate pop\nset rbp ra\n`;
      code += `terminate\n`;
      context.curFunc.returns |= context.curExpr;
    }

    code += `// end function\n`;
    return code;
  }