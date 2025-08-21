import { TypeAliasDeclaration } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { SyntaxKind } from "ts-morph";

export function storeTypeAlias(ta: TypeAliasDeclaration, context: CompilerContext) {
  const aliasName = ta.getName();
  const typeNode = ta.getTypeNode();

  if (!typeNode || !typeNode.isKind(SyntaxKind.TypeLiteral)) {
    if (typeNode) {
      if ([
        'OnEvent', 'constant', 'TLabel', 'CON_NATIVE', 'CON_NATIVE_POINTER', 'quote', 'TAction', 'TMove', 'TAi', 'OnVariation'
      ].includes(aliasName))
        return;

      if (typeNode.getKind() == SyntaxKind.NumberKeyword
        || typeNode.getKind() == SyntaxKind.StringKeyword
        || typeNode.getKind() == SyntaxKind.StringLiteral
        || typeNode.getKind() == SyntaxKind.UnionType)
        return;
    }
    addDiagnostic(ta, context, "warning", `Type alias ${aliasName} is not a literal type.`);
    return;
  }

  if (typeNode.isKind(SyntaxKind.TypeLiteral)) {
    const typeLiteral = typeNode as any;
    const members: Record<string, string> = {};
    typeLiteral.getMembers().forEach((member: any) => {
      if (member.getKind() === SyntaxKind.PropertySignature) {
        const prop = member;
        members[prop.getName()] = prop.getType().getText();
      }
    });
    context.typeAliases.set(aliasName, { name: aliasName, members });
  }

  if (typeNode.isKind(SyntaxKind.NumberKeyword))
    context.typeAliases.set(aliasName, { name: aliasName, literal: 'number', members: {} });

  if (typeNode.isKind(SyntaxKind.StringKeyword | SyntaxKind.UnionType))
    context.typeAliases.set(aliasName, { name: aliasName, literal: 'string', members: {} });
}
