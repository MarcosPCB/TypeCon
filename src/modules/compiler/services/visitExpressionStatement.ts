import { ExpressionStatement } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { visitExpression } from "./visitExpression";

/******************************************************************************
   * expression statement => just visit expression
   *****************************************************************************/
export function visitExpressionStatement(stmt: ExpressionStatement, context: CompilerContext): string {
    return visitExpression(stmt.getExpression(), context);
  }