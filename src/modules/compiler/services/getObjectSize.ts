import { CompilerContext } from "../Compiler";

export function getObjectSize(typeName: string, context: CompilerContext): number {
    // If typeName is defined as a type alias, compute its size by summing the sizes of its members.
    if (context.typeAliases.has(typeName)) {
      const typeDef = context.typeAliases.get(typeName)!;
      let size = 0;
      for (const t of Object.values(typeDef.members)) {
        // If the member is an array type (e.g., "wow[]")
        if (t.endsWith("[]")) {
          // Strip the brackets to get the base type.
          const baseType = t.slice(0, -2).trim();
          // Recursively compute the size for one element of the array.
          if (context.typeAliases.has(baseType)) {
            size += getObjectSize(baseType, context);
          } else {
            // For primitive arrays, assume one slot per element.
            size += 1;
          }
        } else if (context.typeAliases.has(t)) {
          // If the member itself is a user-defined object, compute its size recursively.
          size += getObjectSize(t, context);
        } else {
          // Otherwise, assume a primitive type takes one slot.
          size += 1;
        }
      }
      return size;
    }
    // If the type is not defined as a type alias, assume it is primitive and occupies 1 slot.
    return 1;
  }