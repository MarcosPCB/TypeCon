import { CompilerContext, SymbolDefinition, ESymbolType } from '../Compiler';
import { ArrowFunction } from 'ts-morph';
import { addDiagnostic } from './addDiagnostic';
import { indent } from '../helper/indent';
import { getObjectTypeLayout } from './getObjectLayout';
import { visitStatement } from './visitStatement';

/******************************************************************************
   * VISIT ARROW FUNCTION EXPRESSION
   * => state <functionName> { ... }
   ****************************************************************************/

/*
Arrow function expression and Function expressions will be the same. (if they are kept as references for variables)
They will be saved inside a state routine within a switch. The case clause will hold an address.
So everytime this function gets called, the state _subFunction gets called with RSI holding the address.
*/
export function visitArrowFunctionExpression(af: ArrowFunction, context: CompilerContext): string {
    // new local context
    const localCtx: CompilerContext = {
      ...context,
      localVarOffset: {},
      localVarCount: 0,
      isInSubFunction: true,
      paramMap: {},
      isInLoop: false,
      mainBFunc: false,
      curFunc: undefined,
      symbolTable: new Map(context.symbolTable)
    };

    let code = `${context.options.lineDetail ? `/*${af.getText()}*/` : ''}\nset ra rbp \nstate push\nset rbp rsp\nadd rbp 1\n`;
    af.getParameters().forEach((p, i) => {
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
            addDiagnostic(af, context, 'error', `Undeclared type alias ${tText}`);
            return '';
          }

          children = getObjectTypeLayout(tText, context);
      }
      localCtx.paramMap[p.getName()] = { name: p.getName(), offset: i, type: t, children };
    });

    const body = af.getBody() as any;
    if (body) {
      body.getStatements().forEach(st => {
        code += indent(visitStatement(st, localCtx), 1) + "\n";
      });
    }

    code += `sub rbp 1\nset rsp rbp\nstate pop\nset rbp ra\n\n`;
    return code;
  }