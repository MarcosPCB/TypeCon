import { Expression, BinaryExpression, PropertyAccessExpression, SyntaxKind, CallExpression, PrefixUnaryExpression, Identifier } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { evaluateLiteralExpression } from "../helper/helpers";
import { addDiagnostic } from "./addDiagnostic";

export type IfCondition = { 
    op: "ifand" | "ifeither" | "ifneither" | "ife" | "ifn" | "ifl" | "ifg" | "ifle" | "ifge";
    left: Expression | number;
    right: Expression | number
};

export function parseIfCondition(expr: Expression, context: CompilerContext): IfCondition | undefined {
    if (expr.isKind(SyntaxKind.BinaryExpression)) {
      const bin = expr as BinaryExpression;
      const op = bin.getOperatorToken().getText();
      if (op === "&&") {
        return { op: "ifand", left: bin.getLeft(), right: bin.getRight() };
      }
      if (op === "||") {
        return { op: "ifeither", left: bin.getLeft(), right: bin.getRight() };
      }
      const mapping: Record<string, "ife" | "ifn" | "ifl" | "ifg" | "ifle" | "ifge"> = {
        "==": "ife",
        "!=": "ifn",
        "<": "ifl",
        ">": "ifg",
        "<=": "ifle",
        ">=": "ifge"
      };
      if (mapping[op]) {
        const l = evaluateLiteralExpression(bin.getLeft());
        const r = evaluateLiteralExpression(bin.getRight());
        return { op: mapping[op], left: typeof l !== 'undefined' ? Number(l) : bin.getLeft(), right: typeof r !== 'undefined' ? Number(r) : bin.getRight() };
      }
      addDiagnostic(expr, context, "error", `if condition must be (A&&B), (A||B), a comparison, or a function call. Found operator "${op}"`);
      return undefined;
    }

    if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
      const pExpr = expr as PropertyAccessExpression;
      return { op: "ifge", left: pExpr, right: 1 };
    }

    if (expr.isKind(SyntaxKind.Identifier)) {
      return { op: "ifge", left: expr as Identifier, right: 1 };
    }

    if (expr.isKind(SyntaxKind.CallExpression)) {
      const callExpr = expr as CallExpression;
      //if (nativeFn && nativeFn.returns && nativeFn.return_type === "variable") {
      // Instead of fabricating a fake Expression, simply return 1 as the expected boolean value.
      return { op: "ifg", left: callExpr, right: 0 };
      /*} else {
        addDiagnostic(expr, context, "error", `Native function call ${fnName} not allowed or not returning a boolean value`);
        return undefined;
      }*/
    }
    if (expr.isKind(SyntaxKind.PrefixUnaryExpression)) {
      const pre = expr as PrefixUnaryExpression;
      if (pre.getOperatorToken() === SyntaxKind.ExclamationToken) {
        const sub = pre.getOperand();
        if (sub.isKind(SyntaxKind.BinaryExpression)) {
          const bin = sub as BinaryExpression;
          if (bin.getOperatorToken().getText() === "||") {
            return { op: "ifneither", left: bin.getLeft(), right: bin.getRight() };
          }
        }

        //if (sub.isKind(SyntaxKind.CallExpression)) {
        //const callExpr = sub as CallExpression;;
        //if (nativeFn && nativeFn.returns && nativeFn.return_type === "variable") {
        // Instead of fabricating a fake Expression, simply return 1 as the expected boolean value.
        return { op: "ifle", left: sub, right: 0 };
        /*} else {
          addDiagnostic(expr, context, "error", `Native function call ${fnName} not allowed or not returning a boolean value`);
          return undefined;
        }*/
        //}
        //addDiagnostic(expr, context, "error", `if condition must be in the form !(A || B). Found something else.`);
        //return undefined;
      }
    }

    addDiagnostic(expr, context, "error", `Unrecognized if condition. Must be (A&&B), (A||B), a comparison, or a function call.`);
    return undefined;
  }