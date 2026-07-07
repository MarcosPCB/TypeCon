import { ConstructorDeclaration, Block, ExpressionStatement, SyntaxKind, CallExpression, Expression, ClassDeclaration } from "ts-morph";
import { CompilerContext, ESymbolType, SymbolDefinition } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { EventList } from "../types";
import { indent } from "../helper/indent";
import { parseActorSuperCall, PROJECTILE_FIELD_MAP, parseProjectileSuperCall } from "./actorHelper";
import { getObjectTypeLayout } from "./getObjectLayout";
import { visitStatement } from "./visitStatement";
import { evaluateLiteralExpression } from "../helper/helpers";
import { visitExpression } from "./visitExpression";

 /******************************************************************************
   * CONSTRUCTOR
   * - CActor/CPlayer: parses super() for picnum/extra/isEnemy; compiles the
   *   remaining body into context.actorCustomInitCode (emitted in EVENT_SPAWN
   *   after the _pCptr allocation, so custom properties are accessible).
   * - CEvent: parses super(eventName) only.
   * - Plain class: compiles the full constructor body normally.
   ****************************************************************************/
export function visitConstructorDeclaration(
    ctor: ConstructorDeclaration,
    context: CompilerContext,
    type: string,
  ): string {
    let code = '';
    const body = ctor.getBody() as Block;
    if (body) {
      if (type == 'CActor' || type == 'CPlayer') {
        const statements = body.getStatements();
        // First pass: parse super() to extract picnum/extra/isEnemy
        for (const st of statements) {
          if (st.isKind(SyntaxKind.ExpressionStatement)) {
            const expr = (st as ExpressionStatement).getExpression();
            if (expr.isKind(SyntaxKind.CallExpression)) {
              const call = expr as CallExpression;
              if (call.getExpression().getText() === 'super') {
                if (type === 'CPlayer') {
                  const arg = call.getArguments();
                  if (arg.length > 2)
                    addDiagnostic(call, context, 'warning', `Too many arguments in CPlayer Constructor: ${call.getText()}`);
                  let value = evaluateLiteralExpression(arg[0] as Expression, context);
                  if (value === null) { addDiagnostic(call, context, 'error', `First argument of CPlayer constructor must be a valid constant: ${call.getText()}`); return ''; }
                  context.currentActorPicnum = value as number;
                  value = evaluateLiteralExpression(arg[1] as Expression, context);
                  if (value === null) { addDiagnostic(call, context, 'error', `Second argument of CPlayer constructor must be a valid constant: ${call.getText()}`); return ''; }
                  context.currentActorExtra = value as number;
                } else {
                  parseActorSuperCall(call, context);
                }
              }
            }
          }
        }

        // Second pass: compile all non-super statements into actorCustomInitCode.
        // This code runs inside EVENT_SPAWN after the _pCptr block is allocated,
        // so custom properties are already accessible via getactorvar[THISACTOR]._pCptr.
        // NOTE: actorCustomChildren must be populated before this pass runs —
        //       call visitConstructorDeclaration AFTER the property collection loop.
        const initStatements = statements.filter(st => {
          if (!st.isKind(SyntaxKind.ExpressionStatement)) return true;
          const expr = (st as ExpressionStatement).getExpression();
          if (!expr.isKind(SyntaxKind.CallExpression)) return true;
          return (expr as CallExpression).getExpression().getText() !== 'super';
        });

        if (initStatements.length > 0) {
          const localCtx: CompilerContext = {
            ...context,
            localVarOffset: {},
            localVarCount: 0,
            paramMap: {},
            curFunc: undefined,
          };
          let initCode = '';
          for (const st of initStatements) {
            initCode += indent(visitStatement(st, localCtx), 0);
          }
          context.actorCustomInitCode = (context.actorCustomInitCode ?? '') + initCode;
        }
      } else if (type === 'CProjectile') {
        const statements = body.getStatements();
        // Parse super(picnum, extra?) — sets currentActorPicnum / currentActorExtra
        for (const st of statements) {
          if (!st.isKind(SyntaxKind.ExpressionStatement)) continue;
          const expr = (st as ExpressionStatement).getExpression();
          if (!expr.isKind(SyntaxKind.CallExpression)) continue;
          const call = expr as CallExpression;
          if (call.getExpression().getText() !== 'super') continue;
          parseProjectileSuperCall(call, context);
          break;
        }

        // Compile non-super, non-IProjectile statements into actorCustomInitCode.
        // IProjectile field assignments (this.vel = ...) are emitted as defineprojectile
        // in visitClassDeclaration and must be skipped here to avoid double-emission.
        const initStatements = statements.filter(st => {
          if (!st.isKind(SyntaxKind.ExpressionStatement)) return true;
          const expr = (st as ExpressionStatement).getExpression();
          if (expr.isKind(SyntaxKind.CallExpression) &&
              (expr as CallExpression).getExpression().getText() === 'super') return false;
          if (expr.isKind(SyntaxKind.BinaryExpression)) {
            const left = expr.getLeft();
            if (left.isKind(SyntaxKind.PropertyAccessExpression) &&
                left.getExpression().isKind(SyntaxKind.ThisKeyword) &&
                PROJECTILE_FIELD_MAP[left.getName()]) return false;
          }
          return true;
        });

        if (initStatements.length > 0) {
          const localCtx: CompilerContext = {
            ...context,
            localVarOffset: {},
            localVarCount: 0,
            paramMap: {},
            curFunc: undefined,
          };
          let initCode = '';
          for (const st of initStatements) {
            initCode += indent(visitStatement(st, localCtx), 0);
          }
          context.actorCustomInitCode = (context.actorCustomInitCode ?? '') + initCode;
        }
      } else if (type == 'CEvent') {
        const statements = body.getStatements();
        if(statements.length > 1) {
          addDiagnostic(ctor, context, 'warning', `Only super calls are allowed inside CEvent constructors`);
        }
        for (const st of statements) {
          // e.g. variable statements => might define IAction, IMove, IAi
          // expression => maybe super(...)
          if (st.isKind(SyntaxKind.ExpressionStatement)) {
            const es = st as ExpressionStatement;
            const expr = es.getExpression();
            if (expr.isKind(SyntaxKind.CallExpression)) {
              const call = expr as CallExpression;
              if (call.getExpression().getText() === "super") {
                const arg = call.getArguments();

                if (arg.length > 1)
                  addDiagnostic(call, context, 'warning', `Too many arguments in Event Constructor: ${call.getText()}`);

                if (!arg[0].isKind(SyntaxKind.StringLiteral)) {
                  addDiagnostic(call, context, 'error', `First argument of Event constructor must be the event name: ${call.getText()}`);
                  return '';
                }

                const eventName = arg[0].getText().replace(/[`'"]/g, "");

                if (!EventList.includes(eventName as TEvents)) {
                  addDiagnostic(call, context, 'error', `Event ${eventName} is not valid: ${call.getText()}`);
                  return '';
                }

                context.currentEventName = eventName.toUpperCase();
                context.currentActorPicnum = undefined;
              } else {
                addDiagnostic(ctor, context, 'warning', `Only super calls are allowed inside CActor constructors`);
              }
            }
          }
        }
      } else {
        const statements = body.getStatements();
        const localCtx: CompilerContext = {
          ...context,
          localVarOffset: {},
          localVarCount: 0,
          paramMap: {},
          curFunc: undefined,
        };
        ctor.getParameters().forEach((p, i) => {
          // Use the source-level type annotation text to avoid import-path-qualified names
          // (e.g. p.getType().getText() can return "import('...').TWeaponAnim", but
          // p.getTypeNode()?.getText() returns "TWeaponAnim")
          const typeText = p.getTypeNode()?.getText() ?? p.getType().getText();
          let t: Exclude<ESymbolType, ESymbolType.enum> = ESymbolType.number;
          let children: Record<string, SymbolDefinition>;
          switch (typeText) {
            case 'string':
            case 'pointer':
            case 'boolean':
              t = ESymbolType[typeText as 'string' | 'pointer' | 'boolean'];
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
              t |= ESymbolType.array;
              break;

            default:
              let tText = typeText;

              if (tText.endsWith('[]')) {
                t = ESymbolType.object | ESymbolType.array;
                tText = tText.slice(0, tText.length - 2);
              } else t = ESymbolType.object;

              // Union types (e.g. CProjectile | number, TWeaponOffset | undefined) → number
              if (tText.includes('|')) {
                t = ESymbolType.number;
                break;
              }

              const alias = context.typeAliases.get(tText);

              if (!alias) {
                // Unknown type — treat as number to avoid aborting the whole constructor
                t = ESymbolType.number;
                break;
              }

              children = getObjectTypeLayout(tText, context);
          }
          localCtx.paramMap[p.getName()] = { name: p.getName(), offset: i, type: t, children };
        });
        for (const st of statements) {
          // Intercept super() for plain class inheritance — inline parent's constructor body
          if (context.currentParentClass && st.isKind(SyntaxKind.ExpressionStatement)) {
            const expr = (st as ExpressionStatement).getExpression();
            if (expr.isKind(SyntaxKind.CallExpression) &&
                (expr as CallExpression).getExpression().getText() === 'super') {
              const call = expr as CallExpression;
              // Evaluate super() args into r0..rN (parent constructor parameters)
              call.getArguments().forEach((arg, i) => {
                code += indent(visitExpression(arg as Expression, localCtx, `r${i}`), 1);
              });
              // Re-run parent's constructor body inline in the child's frame
              const parentSymDef = context.symbolTable.get(context.currentParentClass) as SymbolDefinition | undefined;
              const parentCdNode = parentSymDef?.astNode as ClassDeclaration | undefined;
              const parentCtorList = parentCdNode?.getConstructors() ?? [];
              if (parentCtorList.length > 0) {
                const parentBodyCtx: CompilerContext = { ...localCtx, currentParentClass: undefined };
                code += visitConstructorDeclaration(parentCtorList[0], parentBodyCtx, '');
              }
              continue;
            }
          }
          code += indent(visitStatement(st, localCtx), 1);
        }
      }
    }
    return code;
  }