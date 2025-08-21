import { Expression, SyntaxKind, PropertyAccessExpression, ElementAccessExpression} from "ts-morph";
import { MemberSegment } from "../Compiler";

export function unrollMemberExpression(expr: Expression): MemberSegment[] {
    const segments: MemberSegment[] = [];

    function climb(e: Expression) {
      // For property access: objectExpression.propertyName
      if (e.isKind(SyntaxKind.PropertyAccessExpression)) {
        const pae = e as PropertyAccessExpression;
        // Recurse first on the object expression
        climb(pae.getExpression());
        // Then add the property name
        segments.push({
          kind: "property",
          name: pae.getName(),
        });
      }
      // For element access: objectExpression[indexExpression]
      else if (e.isKind(SyntaxKind.ElementAccessExpression)) {
        const eae = e as ElementAccessExpression;
        // Recurse on the object expression
        climb(eae.getExpression());
        // Then add the index expression
        segments.push({
          kind: "index",
          expr: eae.getArgumentExpressionOrThrow(),
        });
      }
      // For a simple identifier: e.g. "foo"
      else if (e.isKind(SyntaxKind.Identifier)) {
        segments.push({
          kind: "identifier",
          name: e.getText(),
        });
      }
      // For "this"
      else if (e.isKind(SyntaxKind.ThisKeyword)) {
        segments.push({
          kind: "this",
          name: "this",
        });
      }
      // Fallback for other expressions you might hit (parenthesized, etc.)
      else {
        // You can handle or flatten further, or store them as a single “identifier”:
        segments.push({
          kind: "identifier",
          name: e.getText(),
        });
      }
    }

    climb(expr);
    return segments;
  }