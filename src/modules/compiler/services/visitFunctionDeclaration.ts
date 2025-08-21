import { FunctionDeclaration, Block, SyntaxKind } from "ts-morph";
import { CompilerContext, ESymbolType, SymbolDefinition } from "../Compiler";
import { ECompileOptions } from "../framework";
import { addDiagnostic } from "./addDiagnostic";
import { indent } from "../helper/indent";
import { getObjectTypeLayout } from "./getObjectLayout";
import { visitStatement } from "./visitStatement";

export function visitFunctionDeclaration(fd: FunctionDeclaration, context: CompilerContext) {
   const name = fd.getName() || "anonFn";
    // new local context
    const localCtx: CompilerContext = {
      ...context,
      localVarOffset: {},
      localVarCount: 0,
      paramMap: {},
      isInLoop: false,
      mainBFunc: false,
      curFunc: undefined,
    };

    let code = `${context.options.lineDetail ? `/*${fd.getText()}*/` : ''}\ndefstate ${localCtx.curModule ? `_${localCtx.curModule.name}_` : ''}${name}\n  set ra rbp \n  state push\n  set rbp rsp\n  add rbp 1\n`;
    fd.getParameters().forEach((p, i) => {
      const type = p.getType();
      let t: Exclude<ESymbolType, ESymbolType.enum> = ESymbolType.number;
      let children: Record<string, SymbolDefinition>;
      let con = '';
      switch (type.getText()) {
        case 'string':
        case 'pointer':
        case 'boolean':
          t = ESymbolType[type.getText()];
          break;

        case 'IAction':
        case 'IMove':
        case 'IAi':
          t = ESymbolType.object;
          children = type.getText() == 'IAction' ? {
            loc: { name: 'loc', offset: 0, type: ESymbolType.number },
            start: { name: 'start', offset: 0, type: ESymbolType.number },
            length: { name: 'length', offset: 0, type: ESymbolType.number },
            viewType: { name: 'viewType', offset: 0, type: ESymbolType.number },
            incValue: { name: 'incValue', offset: 0, type: ESymbolType.number },
            delay: { name: 'delay', offset: 0, type: ESymbolType.number },
          } : (type.getText() == 'IMove' ? {
            loc: { name: 'loc', offset: 0, type: ESymbolType.number },
            horizontal_vel: { name: 'horizontal_vel', offset: 0, type: ESymbolType.number },
            vertical_vel: { name: 'vertical_vel', offset: 0, type: ESymbolType.number },
          } : {
            loc: { name: 'loc', offset: 0, type: ESymbolType.number },
            action: { name: 'action', offset: 0, type: ESymbolType.number },
            move: { name: 'move', offset: 0, type: ESymbolType.number },
            flags: { name: 'flags', offset: 0, type: ESymbolType.number },
          });
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
          let tText = type.getText();

          if (type.getText().endsWith('[]')) {
            t = ESymbolType.object | ESymbolType.array;
            tText = tText.slice(0, tText.length - 2);
          } else t = ESymbolType.object;

          const alias = context.typeAliases.get(tText);

          if (!alias) {
            addDiagnostic(fd, context, 'error', `Undeclared type alias ${tText}`);
            return '';
          }

          children = getObjectTypeLayout(tText, context);
      }
      localCtx.paramMap[p.getName()] = { name: p.getName(), offset: i, type: t, children };
    });

    context.symbolTable.set(name, {
      name: `${localCtx.curModule ? `_${localCtx.curModule.name}_` : ''}${name}`,
      type: ESymbolType.function,
      offset: 0
    });

    localCtx.symbolTable.set(name, {
      name: `${localCtx.curModule ? `_${localCtx.curModule.name}_` : ''}${name}`,
      type: ESymbolType.function,
      offset: 0
    });

    localCtx.curFunc = localCtx.symbolTable.get(name) as SymbolDefinition;

    if (context.currentFile.options & ECompileOptions.state_decl) {
      const t = fd.getReturnType();
      if (t.getAliasSymbol().getName() == 'CON_NATIVE') {
        const args = t.getAliasTypeArguments();

        if (args.length > 0) {
          (localCtx.symbolTable.get(name) as SymbolDefinition).CON_code = (localCtx.symbolTable.get(name) as SymbolDefinition).name = args[0].getText().replace(/[`'"]/g, "");
          (context.symbolTable.get(name) as SymbolDefinition).CON_code = (context.symbolTable.get(name) as SymbolDefinition).name = args[0].getText().replace(/[`'"]/g, "");
        }
      }
    }

    const t = fd.getReturnType();

    if (t && t.getAliasSymbol() && t.getAliasSymbol().getName() == 'CON_NATIVE_STATE') {
      const args = t.getAliasTypeArguments();

      if (args.length > 0) {
        (localCtx.symbolTable.get(name) as SymbolDefinition).CON_code = (localCtx.symbolTable.get(name) as SymbolDefinition).name = args[0].getText().replace(/[`'"]/g, "");
        (context.symbolTable.get(name) as SymbolDefinition).CON_code = (context.symbolTable.get(name) as SymbolDefinition).name = args[0].getText().replace(/[`'"]/g, "");
      }
    }

    const body = fd.getBody() as Block;
    if (body) {
      const params = Object.keys(localCtx.paramMap).length;

      if (body.getDescendantsOfKind(SyntaxKind.ArrowFunction).length > 0) {
        if (params > 0) {
          code += indent(`state pushr${params > 12 ? 'all' : params}\n`, 1);
          Object.entries(localCtx.paramMap).forEach((e, i) => {
            localCtx.symbolTable.set(e[0], {
              ...e[1],
              offset: i
            });

            localCtx.localVarCount++;
          });
        }
      }

      body.getStatements().forEach(st => {
        code += indent(visitStatement(st, localCtx), 1) + "\n";
      });

      if (body.getDescendantsOfKind(SyntaxKind.ArrowFunction).length > 0) {
        if (params > 0) {
          code += indent(`state popr${params > 12 ? 'all' : params}\n`, 1);

          Object.entries(localCtx.paramMap).forEach((e, i) => {
            localCtx.symbolTable.delete(e[0]);
          });
        }
      }
    }

    context.symbolTable.set(name, localCtx.symbolTable.get(name));

    code += `  sub rbp 1\n  set rsp rbp\n  state pop\n  set rbp ra\nends \n\n`;
    return code;
}
