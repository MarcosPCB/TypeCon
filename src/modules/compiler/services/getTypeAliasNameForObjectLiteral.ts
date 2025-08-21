import { ObjectLiteralExpression, SyntaxKind, VariableDeclaration } from "ts-morph";

export function getTypeAliasNameForObjectLiteral(objLit: ObjectLiteralExpression): string | undefined {
    const parent = objLit.getParent();
    if (parent && parent.getKind() === SyntaxKind.VariableDeclaration) {
      const vd = parent as VariableDeclaration;
      const typeNode = vd.getTypeNode();
      if (typeNode) {
        return typeNode.getText(); // This should match one of the stored type aliases
      }
    }
    return undefined;
  }