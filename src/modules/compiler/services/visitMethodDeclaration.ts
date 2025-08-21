import { MethodDeclaration, SyntaxKind } from "ts-morph";
import { CompilerContext, SegmentProperty, ESymbolType, SymbolDefinition } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { indent } from "../helper/indent";
import { unrollMemberExpression } from "./unrollMemberExpression";
import { visitStatement } from "./visitStatement";
import { getTypeBase } from "./getTypeBase";
import { getObjectTypeLayout } from "./getObjectLayout";

  /******************************************************************************
   * visitMethodDeclaration => if main() => useractor ...
   ****************************************************************************/
export function visitMethodDeclaration(
    md: MethodDeclaration,
    className: string,
    context: CompilerContext,
    type: string
  ): string {
    const mName = md.getName();
    const curFunc = context.curFunc;
    const localCtx: CompilerContext = {
      ...context,
      localVarOffset: {},
      localVarCount: 0,
      paramMap: {},
      isInLoop: false,
      mainBFunc: false,
      curFunc: undefined,
      hasLocalVars: false
    };

    if (type == 'CActor' && mName.toLowerCase() === "main") {
      const pic = localCtx.currentActorPicnum || 0;
      const extra = localCtx.currentActorExtra || 0;
      let firstAction = '0';
      const enemy = localCtx.currentActorIsEnemy ? 1 : 0;
      localCtx.mainBFunc = true;
      md.getParameters().forEach((p, i) => {
        const type = p.getType();

        if(p.getName() == 'first_action') {
          const init = p.getInitializer();

          if(!init) {
            addDiagnostic(p, localCtx, 'warning', `Missing first action initilizer in Main from ${className}`);
            return;
          }

          if(init.isKind(SyntaxKind.ElementAccessExpression) || init.isKind(SyntaxKind.PropertyAccessExpression)) {
            const segments = unrollMemberExpression(init);

            const seg = segments.at(-1) as SegmentProperty;

            const label = localCtx.currentActorLabels[seg.name];

            if(!label) {
              addDiagnostic(p, localCtx, 'warning', `Undefined first action ${init.getText()} in Main from ${className}`);
              return;
            }

            firstAction = label.name;
          }
        }
      });

      let code = `${context.options.lineDetail ? `/*${md.getText()}*/` : ''}\n${localCtx.currentActorHardcoded ? 'actor' : `useractor ${enemy}` } ${pic} ${extra} ${firstAction} \n  findplayer playerDist\n  set ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n  set rbbp rbp\n`;
      const body = md.getBody() as any;
      if (body) {
        body.getStatements().forEach(st => {
          code += indent(visitStatement(st, localCtx), 1) + "\n";
        });
      }
      code += `  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nenda \n\n`;
      return code;
    } else if (type == 'CEvent' && (mName.toLowerCase() == 'append' || mName.toLowerCase() == 'prepend')) {
      let code = `${context.options.lineDetail ? `/*${md.getText()}*/` : ''}\n${mName.toLowerCase() == 'append' ? 'append' : 'on'}event EVENT_${context.currentEventName}\n  set ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n  set rbbp rbp\n`;
      const body = md.getBody() as any;
      if (body) {
        body.getStatements().forEach(st => {
          code += indent(visitStatement(st, localCtx), 1) + "\n";
        });
      }
      code += `  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nendevent \n\n`;
      return code;
    }

    // otherwise => normal state
    let code = `${context.options.lineDetail ? `/*${md.getText()}*/` : ''}\ndefstate ${className}_${mName}\n`;

    //if(md.getDescendantsOfKind(SyntaxKind.VariableDeclaration).length > 0) {
      //localCtx.hasLocalVars = true;
      code += `  set ra rbp \n  state push \n  set rbp rsp\n  add rbp 1\n`;
    //}

    md.getParameters().forEach((p, i) => {
      const type = p.getType();
      let t: Exclude<ESymbolType, ESymbolType.enum> = ESymbolType.number;
      let children: Record<string, SymbolDefinition>;
      let con = '';
      switch (type.getText()) {
        case 'string':
        case 'boolean':
        case 'pointer':
          t = ESymbolType[type.getText()];
          break;

        case 'constant':
        case 'number':
          break;

        case 'string[]':
          t = ESymbolType.string | ESymbolType.array;
          break;

        case 'quote':
          t = ESymbolType.quote;
          break;

        case 'number[]':
        case '[]':
        case 'any[]':
          t |= ESymbolType.array
          break;

        default:
          let tText = type.getText();

          if (type.getText().endsWith('[]')) {
            t = ESymbolType.array | ESymbolType.object;
            tText = tText.slice(0, tText.length - 2);
          } else t = ESymbolType.object;

          let alias = context.typeAliases.get(tText);

          if (!alias) {
            //Since it's a parameter, we can try to store this type
            const typeR = getTypeBase(p.getTypeNode(), context);

            if (!typeR) {
              addDiagnostic(md, context, 'error', `Undeclared type alias ${tText}`);
              return '';
            }

            t = ESymbolType[typeR];
          }

          if (t & ESymbolType.object)
            children = getObjectTypeLayout(tText, context);
      }
      localCtx.paramMap[p.getName()] = { name: p.getName(), offset: i, type: t, children };
    });

    localCtx.symbolTable.set(mName, {
      name: `${className}_${mName}`,
      type: ESymbolType.function,
      offset: 0,
    });

    localCtx.curFunc = localCtx.symbolTable.get(mName) as SymbolDefinition;
    if (type == '') {
      context.curClass.children[mName] = localCtx.symbolTable.get(mName);
      const numParams = Object.keys(localCtx.paramMap).length;

      code += indent(`setarray flat[rbp] r${numParams}\nadd rsp 1\n`, 1);
      localCtx.localVarCount++;
    }

    const t = md.getReturnType();
    const tSym = t.getAliasSymbol();
    if(tSym && tSym.getName().includes('CON_NATIVE_STATE')) {
      const args = t.getAliasTypeArguments();

      if(args.length > 0) {
        (localCtx.symbolTable.get(mName) as SymbolDefinition).CON_code = args[0].getText().replace(/[`'"]/g, "");
        (context.symbolTable.get(mName) as SymbolDefinition).CON_code = args[0].getText().replace(/[`'"]/g, "");
      };
    }

    const body = md.getBody() as any;
    if (body) {
      body.getStatements().forEach(st => {
        code += indent(visitStatement(st, localCtx), 1) + "\n";
      });
    }

    context.curFunc = curFunc;
    //if(md.getDescendantsOfKind(SyntaxKind.VariableDeclaration).length > 0)
      code += `  sub rbp 1\n  set rsp rbp\n  state pop\n  set rbp ra\n`;

    code += `ends\n\n`;
    return code;
  }