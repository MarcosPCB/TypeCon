import { Block, Statement, SyntaxKind } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { visitStatement } from "./visitStatement";

export function visitBlockOrStmt(s: Statement, context: CompilerContext): string {
    if (s.isKind(SyntaxKind.Block)) {
      const blk = s as Block;
      return blk.getStatements().map(st => visitStatement(st, context)).join("\n");
    }
    return visitStatement(s, context);
  }