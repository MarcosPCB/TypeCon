import { ParenthesizedExpression } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { visitExpression } from "./visitExpression";

export function visitParenthesizedExpression(expr: ParenthesizedExpression, context: CompilerContext, reg = 'ra'): string {
    return visitExpression(expr.getExpression(), context, reg);
  }