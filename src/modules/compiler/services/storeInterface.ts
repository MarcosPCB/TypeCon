import { InterfaceDeclaration, SyntaxKind, PropertySignature } from "ts-morph";
import { CompilerContext } from "../Compiler";

export function storeInterface(id: InterfaceDeclaration, context: CompilerContext) {
  const aliasName = id.getName();

  const members: Record<string, string> = {};
  const membersCode: Record<string, string> = {};
  id.getMembers().forEach((member, i) => {
    if (member.getKind() === SyntaxKind.PropertySignature) {
      const prop = member as PropertySignature;
      if (prop.getType().getAliasSymbol() && prop.getType().getAliasSymbol().getName() == 'CON_NATIVE_GAMEVAR') {
        const type = prop.getType().getAliasTypeArguments()[1].getText().replace(/[`'\"]/g, "");
        const code = prop.getType().getAliasTypeArguments()[0].getText().replace(/[`'\"]/g, "");
        members[prop.getName()] = type;
        membersCode[prop.getName()] = code;
      } else members[prop.getName()] = prop.getType().getText();
    }
  });
  context.typeAliases.set(aliasName, { name: aliasName, members, membersCode });
}
