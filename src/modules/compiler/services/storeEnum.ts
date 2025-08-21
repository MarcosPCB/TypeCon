import { EnumDeclaration, SyntaxKind, EnumMember } from "ts-morph";
import { CompilerContext } from "../Compiler";

export function storeEnum(ed: EnumDeclaration, context: CompilerContext) {
  const name = ed.getName();

  const members: Record<string, number> = {};
  ed.getMembers().forEach((member, i) => {
    if (member.getKind() === SyntaxKind.EnumMember) {
      const prop = member as EnumMember;
      members[prop.getName()] = prop.getValue() as number;
    }
  });
  context.symbolTable.set(name, { name: name, type: 4096, children: members });
}
