import { TypeAliasDeclaration, TypeNode, Node } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { baseFromType } from "./baseFromType";
import { storeTypeAlias } from "./storeTypeAlias";

/**
 * Resolves a TypeNode (or anything that eventually points to it) to the
 * primitive “base” that the compiler cares about: `string`, `number`,
 * `boolean` or `object`.
 *
 * – If the node is a type‑alias, we follow the alias recursively.  
 * – If it is a union we make sure every member resolves to the **same**
 *   base (only homogeneous unions are allowed).  
 * – If it is, or resolves to, an object literal we cache its layout with
 *   `storeAliasType`.  
 * – When the type cannot be reduced to one of the four bases we emit a
 *   diagnostic and return `null`.
 */
export function getTypeBase(tn: TypeNode, ctx: CompilerContext): string | null {
    const type = tn.getType();

    /* ────────────────────────────────────────────────────────────────────
     * 1.  Unions – every member must collapse to the same base
     * ──────────────────────────────────────────────────────────────────── */
    if (type.isUnion()) {
      const bases = type.getUnionTypes()
        .map(u => baseFromType(u, ctx))
        .filter((b): b is string => !!b);

      const first = bases[0];
      const allSame = bases.every(b => b === first);

      if (!allSame) {
        addDiagnostic(tn, ctx, "error",
          `Union members must share the same base: ${type.getText()}`);
        return null;
      }
      return first;
    }

    /* ────────────────────────────────────────────────────────────────────
     * 2.  Primitives & literal primitives
     * ──────────────────────────────────────────────────────────────────── */
    if (type.isString() || type.isStringLiteral()) return "string";
    if (type.isNumber() || type.isNumberLiteral()) return "number";
    if (type.isBoolean() || type.isBooleanLiteral()) return "boolean";

    /* ────────────────────────────────────────────────────────────────────
     * 3.  Inline object literal  { a: string }
     * ──────────────────────────────────────────────────────────────────── */
    if (Node.isTypeLiteral(tn)) {
      storeTypeAlias(tn as unknown as TypeAliasDeclaration, ctx);   // unnamed literal
      return "object";
    }

    /* ────────────────────────────────────────────────────────────────────
     * 4.  Type references  Foo, Bar<Baz>, SomeInterface
     *     (includes aliases, interfaces, classes, generics…)
     * ──────────────────────────────────────────────────────────────────── */
    if (Node.isTypeReference(tn)) {
      const aliSym = type.getAliasSymbol();           // present only for aliases
      if (aliSym) {
        const aliasDecl = aliSym.getDeclarations()
          .find(Node.isTypeAliasDeclaration) as TypeAliasDeclaration | undefined;

        if (aliasDecl) {
          const aliasedNode = aliasDecl.getTypeNode();
          if (aliasedNode) {
            // cache literal shapes declared via alias
            if (Node.isTypeLiteral(aliasedNode)) {
              storeTypeAlias(aliasedNode as unknown as TypeAliasDeclaration, ctx);
            }
            return getTypeBase(aliasedNode, ctx);   // recurse
          }
        }
      }
      // Any other reference (interface, class, generic instantiation…)
      return "object";
    }

    /* ────────────────────────────────────────────────────────────────────
     * 5.  Fallback for plain object types
     * ──────────────────────────────────────────────────────────────────── */
    if (type.isObject()) return "object";

    /* ────────────────────────────────────────────────────────────────────
     * 6.  Unsupported
     * ──────────────────────────────────────────────────────────────────── */
    addDiagnostic(tn, ctx, "error",
      `Unsupported parameter type: ${type.getText()}`);
    return null;
  }