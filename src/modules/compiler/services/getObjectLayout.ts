import { CompilerContext, SymbolDefinition } from "../Compiler";
import { getObjectSize } from "./getObjectSize";
import { getSymbolType } from "./getSymbolType";

export function getObjectTypeLayout(typeName: string, context: CompilerContext): { [key: string]: SymbolDefinition } {
    if (context.typeAliases.has(typeName)) {
      const typeDef = context.typeAliases.get(typeName)!;
      let layout: { [key: string]: SymbolDefinition } = {};
      const keys = Object.keys(typeDef.members);
      for (let i = 0; i < keys.length; i++) {
        const t = typeDef.members[keys[i]];
        const code = typeDef.membersCode ? typeDef.membersCode[keys[i]] : undefined;
        const k = keys[i];
        let children: Record<string, SymbolDefinition> = undefined;
        // If the member is an array type (e.g., "wow[]")
        if (t.endsWith("[]")) {
          // Strip the brackets to get the base type.
          const baseType = t.slice(0, -2).trim();
          // Recursively compute the layout for one element of the array.
          if (context.typeAliases.has(baseType)) {
            children = getObjectTypeLayout(baseType, context);
            layout[k] = {
              name: k,
              //@ts-ignore
              type: getSymbolType(t, context),
              offset: i,
              size: getObjectSize(baseType, context),
              num_elements: Object.keys(children).length,
              children
            };
          } else {
            layout[k] = {
              name: k,
              //@ts-ignore
              type: getSymbolType(t, context),
              offset: i,
              size: 1,
              children
            };
          }
        } else {
          if (context.typeAliases.has(t))
            children = getObjectTypeLayout(t, context);

          layout[k] = {
            name: k,
            //@ts-ignore
            type: getSymbolType(t, context),
            offset: i,
            size: context.typeAliases.has(t) ? getObjectSize(t, context) : 1,
            num_elements: context.typeAliases.has(t) ? Object.keys(children).length : 1,
            CON_code: code,
            children
          };
        }
      }

      return layout;
    }
  }