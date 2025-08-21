import { ObjectLiteralExpression, SyntaxKind, VariableDeclaration } from "ts-morph";

export function getVarNameForObjectLiteral(objLit: ObjectLiteralExpression): string | undefined {
    const parent = objLit.getParent();
    if (parent && parent.getKind() === SyntaxKind.VariableDeclaration) {
      const vd = parent as VariableDeclaration;
      return vd.getName();
    }
    return undefined;
  }