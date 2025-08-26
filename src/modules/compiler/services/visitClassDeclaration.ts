import { ClassDeclaration, SyntaxKind, Statement, Block, ObjectLiteralExpression } from "ts-morph";
import { CompilerContext, SymbolDefinition, ESymbolType, EHeapType } from "../Compiler";
import { indent } from "../helper/indent";
import { addDiagnostic } from "./addDiagnostic";
import { EventList } from "../types";
import { visitConstructorDeclaration } from "./visitConstructorDeclaration";
import { parseVarForActionsMovesAi } from "./actorHelper";
import { visitStatement } from "./visitStatement";
import { getObjectTypeLayout } from "./getObjectLayout";
import { getObjectSize } from "./getObjectSize";
import { visitMethodDeclaration } from "./visitMethodDeclaration";
import { visitMemberExpression } from "./visitMemberExpression";
import { visitLeafOrLiteral } from "./visitLeafOrLiteral";

/******************************************************************************
   * VISIT CLASS DECL => if extends CActor => parse constructor => skip code => gather actions
   ****************************************************************************/
export function visitClassDeclaration(cd: ClassDeclaration, context: CompilerContext): string {
    const className = cd.getName() || "AnonClass";
    let code = context.options.lineDetail ? `// class ${className}\n` : '';

    const base = cd.getExtends()?.getExpression().getText() || "";
    const type = base;
    // const isEvent = base === "CEvent"; // demonstration if needed

    // We'll create a local context for parsing this class
    const localCtx: CompilerContext = {
      ...context,
      localVarOffset: {},
      localVarCount: 0,
      initCode: '',
      paramMap: {},
      currentActorPicnum: undefined,
      currentActorExtra: undefined,
      currentActorIsEnemy: undefined,
      currentActorFirstAction: undefined,
      currentActorHardcoded: false,
      currentActorLabelAsObj: true,
      currentActorActions: [],
      currentActorMoves: [],
      currentActorAis: [],
      currentActorLabels: {},
      isPlayer: undefined,
      mainBFunc: false,
      curFunc: undefined,
    };

    let cls: SymbolDefinition;

    if (type == '') {
      cls = context.symbolTable.get(className) as SymbolDefinition;
      if (cls) {
        addDiagnostic(cd, context, 'error', `Duplicate definition. Tried to declare a class named ${className} when there's already a ${cls.type} with the same name`);
        return '';
      }

      context.symbolTable.set(className, {
        name: className,
        type: ESymbolType.class,
        offset: 0,
        num_elements: 0,
        size: 0,
        heap: true,
        children: {}
      });

      cls = context.symbolTable.get(className) as SymbolDefinition;
    }

    // visit constructor(s)
    const ctors = cd.getConstructors();
    if (ctors.length > 0 && type != '') {
      code += visitConstructorDeclaration(ctors[0], localCtx, type);
    }

    if(type == 'CActor') {
      localCtx.symbolTable.set('defaultPicnum', {
        name: 'defaultPicnum',
        offset: 0,
        type: ESymbolType.constant,
        literal: localCtx.currentActorPicnum
      });

      localCtx.symbolTable.set('defaultStrength', {
        name: 'defaultStrength',
        offset: 0,
        type: ESymbolType.constant,
        literal: localCtx.currentActorExtra
      });
    } else if(type == 'CPlayer') {
      localCtx.isPlayer = true;
    }

    // visit properties
    const properties = cd.getProperties();
    let codeV = '';
    let hasLabels = false;

    for (const p of properties) {
      if(p.getTypeNode().getText().match(/\b(TAction|IAction|TMove|IMove|TAi|IAi)\b/)) {
        if(!hasLabels) {
          localCtx.initCode = `setarray flat[${localCtx.globalVarCount}] 0\n`
          localCtx.globalVarCount++;
          localCtx.symbolTable.set(`lb${localCtx.currentActorPicnum}_enabler`, {
            name: `lb${localCtx.currentActorPicnum}_enabler`,
            offset: localCtx.globalVarCount - 1,
            global: true,
            type: ESymbolType.boolean
          });

          hasLabels = true;
        }

        parseVarForActionsMovesAi(p, localCtx, className);
      }

      if (p.getTypeNode().getText() == 'OnEvent') {
        const init = p.getInitializerOrThrow();

        if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const events = init.getProperties();

          for (const e of events) {
            if (!e.isKind(SyntaxKind.MethodDeclaration)) {
              addDiagnostic(e, context, 'error', `OnEvent property must only contain functions: ${p.getText()}`);
              return '';
            }

            const eFnName = e.getName();

            if (!EventList.includes(eFnName as TEvents)) {
              addDiagnostic(e, context, 'error', `Invalid event ${e.getName()}: ${p.getText()}`);
              return '';
            }

            const evntLocalCtx: CompilerContext = {
              ...localCtx,
              localVarOffset: {},
              localVarCount: 0,
              paramMap: {}
            };

            code += `${context.options.lineDetail ? `\n/*${e.getText()}*/` : ''}\nonevent EVENT_${eFnName.toUpperCase()}\nset ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n  ifactor ${localCtx.currentActorPicnum} {\n`;
            const body = e.getBody() as any;
            if (body) {
              const stmts = body.getStatements() as Statement[];

              stmts.forEach(s => {
                code += visitStatement(s, evntLocalCtx);
              });
            }

            code += `  }\n  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nendevent \n\n`;
          }
        }
      } else if (type == '') {
        const pName = p.getName();
        const pType = p.getTypeNode().getText();

        cls.children[pName] = { name: pName, offset: cls.num_elements, type: ESymbolType.number };

        switch (pType) {
          case 'string':
          case 'number':
          case 'pointer':
          case 'boolean':
            cls.children[pName].type = ESymbolType[pType];
            break;

          case 'string[]':
            cls.children[pName].type = ESymbolType.string | ESymbolType.array;
            break;

          case 'number[]':
          case '[]':
            cls.children[pName].type = ESymbolType.array;
            break;

          default:
            let t = pType;
            let isArray = false;
            if (t.endsWith('[]')) {
              t = pType.slice(0, t.length - 2);
              isArray = true;
            }

            const type = context.typeAliases.get(t);

            if (!type) {
              addDiagnostic(p, context, 'error', `Undeclared type ${pType}`);
              return '';
            }

            if (type.literal) {
              if (type.literal == 'string' && isArray)
                cls.children[pName].type = ESymbolType.string | ESymbolType.array;
              else if (isArray)
                cls.children[pName].type = ESymbolType.array;
              else cls.children[pName].type = type.literal as any;
            } else {
              cls.children[pName].type = ESymbolType.object | (isArray ? ESymbolType.array : 0);
              cls.children[pName].children = getObjectTypeLayout(t, context);
              cls.children[pName].size = getObjectSize(t, context);
              cls.children[pName].num_elements = Object.keys(cls.children[pName].children).length;
            }
        }
        cls.num_elements++;
      }
    }

    let labels = '';

    // if CActor => append the actions/moves/ais lines
    if (type == 'CActor') {
      for (const a of localCtx.currentActorActions) {
        labels += a + "\n";
      }
      for (const mv of localCtx.currentActorMoves) {
        labels += mv + "\n";
      }
      for (const ai of localCtx.currentActorAis) {
        labels += ai + "\n";
      }
    }

    if (ctors.length > 0 && type == '') {
      context.curClass = cls;
      code = `${context.options.lineDetail ? `/*${ctors[0].getText()}*/` : ''}\ndefstate ${className}_constructor \n  set ra rbp \n  state push \n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;
      code += indent(`state pushr2\nset r0 ${cls.num_elements}\nset r1 ${EHeapType.object}\nstate alloc\nstate popr2\nstate pushb\n`, 1);
      code += visitConstructorDeclaration(ctors[0], context, '');
      code += `  state popb\n  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\nends \n\n`;
    }

    // visit methods
    const methods = cd.getInstanceMethods();
    for (const m of methods)
      code += visitMethodDeclaration(m, className, type != '' ? localCtx : context, type);

    for(const p of properties) {
      if (p.getTypeNode().getText().includes('OnVariation')) {
        const init = p.getInitializerOrThrow();

        if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const events = init.getProperties();

          for (const e of events) {
            if (!e.isKind(SyntaxKind.MethodDeclaration)) {
              addDiagnostic(e, context, 'error', `OnVariation property must only contain functions: ${p.getText()}`);
              return '';
            }

            const eFnName = e.getName();

            const variationLocalCtx: CompilerContext = {
              ...localCtx,
              localVarOffset: {},
              localVarCount: 0,
              paramMap: {}
            };


            const body = e.getBody() as Block;
            if (body) {
              const stmts = body.getStatements() as Statement[];

              const cactor = body.getDescendantsOfKind(SyntaxKind.ReturnStatement)

              if(cactor.length == 0) {
                addDiagnostic(init, localCtx, 'error', `Missing return statement on actor variation: ${eFnName}`);
                return '';
              }

              const exp = cactor[0].getExpression();
              if(!exp.isKind(SyntaxKind.ObjectLiteralExpression)) {
                addDiagnostic(init, localCtx, 'error', `Return statement is not a object literal: ${exp.getText()}`);
                return '';
              }

              const obj: ObjectLiteralExpression = exp as ObjectLiteralExpression;

              let picnum = -1, extra = 0, action = '';

              obj.getProperties().forEach(e => {
                if(e.isKind(SyntaxKind.PropertyAssignment)) {
                  let val: string | number;
                  const init = e.getInitializer();

                  if(init.isKind(SyntaxKind.ElementAccessExpression) || init.isKind(SyntaxKind.PropertyAccessExpression))
                    val = visitMemberExpression(init, localCtx, false, true);

                  if(init.isKind(SyntaxKind.Identifier))
                    val = visitLeafOrLiteral(init, localCtx, true);

                  switch(e.getName()) {
                    case 'picnum':
                      picnum = Number(val);
                      break;

                    case 'extra':
                      extra = Number(val);
                      break;

                    case 'first_action':
                      action = String(val);
                      break;
                  }
                }
              });

              codeV += `${context.options.lineDetail ? `\n/*${e.getText()}*/` : ''}\n${localCtx.currentActorHardcoded ? 'actor' : `useractor ${localCtx.currentActorIsEnemy ? 1 : 0}` } ${picnum} ${extra} ${action}\n  set ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;

              stmts.forEach(s => {
                if(!s.isKind(SyntaxKind.ReturnStatement))
                  codeV += indent(visitStatement(s, variationLocalCtx), 1);
              });
            }

            codeV += `  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nenda \n\n`;
          }
        }
      }
    }

    code += codeV;

    context.curClass = null;

    code = labels + '\n' + (localCtx.initCode != ''
      ? `
appendevent EVENT_NEWGAME
${indent(localCtx.initCode, 1)}
  add ri 1
  set rbp ri
  set rsp rbp
  sub rsp 1
endevent

appendevent EVENT_SPAWN
  ifactor ${localCtx.currentActorPicnum} {
    ife flat[${(localCtx.symbolTable.get(`lb${localCtx.currentActorPicnum}_enabler`) as SymbolDefinition).offset}] 0 {
      setarray flat[${(localCtx.symbolTable.get(`lb${localCtx.currentActorPicnum}_enabler`) as SymbolDefinition).offset}] 1
      geta[].htg_t 4 ra
      geta[].htg_t 1 rb
      geta[].htg_t 5 rc
      geta[].hitag rd

${Object.values(localCtx.currentActorLabels).map(e => {
        if(e.name.startsWith('A_'))
          return `
      set ri flat[${e.parent ? e.parent.offset : e.offset}]
      ${e.parent && e.offset != 0 ? `add ri ${e.offset}`: ''}
      action ${e.name}
      setarray flat[flat[ri]] sprite[].htg_t 4`;

        if(e.name.startsWith('M_'))
          return `
      set ri flat[${e.parent ? e.parent.offset : e.offset}]
      ${e.parent && e.offset != 0 ? `add ri ${e.offset}`: ''}
      move ${e.name} 0
      setarray flat[flat[ri]] sprite[].htg_t 1`;

          return `
      set ri flat[${e.parent ? e.parent.offset : e.offset}]
      ${e.parent && e.offset != 0 ? `add ri ${e.offset}`: ''}
      ai ${e.name}
      set ri flat[ri]
      setarray flat[ri] sprite[].htg_t 5
      add ri 1
      setarray flat[ri] sprite[].htg_t 4
      add ri 1
      setarray flat[ri] sprite[].htg_t 1
      add ri 1
      setarray flat[ri] sprite[].hitag`;
    }).join('\n')}

      seta[].htg_t 4 ra
      seta[].htg_t 1 rb
      seta[].htg_t 5 rc
      seta[].hitag rd
    }
  }
endevent
` : '') + code;

    return code;
  }