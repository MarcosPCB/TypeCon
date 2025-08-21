import { CompilerContext, ESymbolType } from "../Compiler";

export function getSymbolType(type: string, context: CompilerContext): ESymbolType {
    let t: Exclude<ESymbolType, ESymbolType.enum> = ESymbolType.number;
    switch (type) {
      case 'string':
      case 'pointer':
      case 'boolean':
        t = ESymbolType[type];
        break;

      case 'constant':
      case 'number':
        break;

      case 'quote':
        t = ESymbolType.quote;
        break;

      case 'string[]':
        t = ESymbolType.string | ESymbolType.array;
        break;

      case 'number[]':
      case '[]':
      case 'any[]':
        t = ESymbolType.array;
        break;

      default:
        let tText = type;

        if (type.endsWith('[]')) {
          t = ESymbolType.object | ESymbolType.array;
          tText = tText.slice(0, tText.length - 2);
        } else t = ESymbolType.object;

        const alias = context.typeAliases.get(tText);

        if (!alias)
          return ESymbolType.error;
    }

    return t;
  }