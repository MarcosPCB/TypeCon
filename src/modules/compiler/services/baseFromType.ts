import { Node, Type } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { getTypeBase } from "./getTypeBase";

  /* -------------------------------------------------------------------- */
  /* Helper for reducing a ts-morph Type when we don’t have its node      */
  /* -------------------------------------------------------------------- */
export function baseFromType(t: Type, ctx: CompilerContext): string | null {
    const node = t.getSymbol()?.getDeclarations()?.find(Node.isTypeNode);
    if (node) return getTypeBase(node, ctx);

    // Literal types (`"foo"`, `42`) don’t have declarations; create one on‑the‑fly
    const sf = ctx.project.createSourceFile("__temp.ts", `type __T = ${t.getText()};`);
    const litNode = sf.getTypeAliasOrThrow("__T").getTypeNodeOrThrow();
    const base = getTypeBase(litNode, ctx);
    sf.delete();
    return base;
  }