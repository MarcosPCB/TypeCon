import { ConstructorDeclaration, Block, ExpressionStatement, SyntaxKind, CallExpression } from "ts-morph";
import { CompilerContext, ESymbolType, SymbolDefinition } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { EventList } from "../types";
import { indent } from "../helper/indent";
import { parseActorSuperCall } from "./actorHelper";
import { getObjectTypeLayout } from "./getObjectLayout";
import { visitStatement } from "./visitStatement";

 /******************************************************************************
   * CONSTRUCTOR => skip code, parse object literals for IAction, IMove, IAi, parse super(...) for picnum
   ****************************************************************************/
export function visitConstructorDeclaration(
    ctor: ConstructorDeclaration,
    context: CompilerContext,
    type: string,
  ): string {
    let code = '';
    const body = ctor.getBody() as Block;
    if (body) {
      if (type == 'CActor') {
        const statements = body.getStatements();
        if(statements.length > 1) {
          addDiagnostic(ctor, context, 'warning', `Only super calls are allowed inside CActor constructors`);
        }
        for (const st of statements) {
          // expression => super(...)
          if (st.isKind(SyntaxKind.ExpressionStatement)) {
            const es = st as ExpressionStatement;
            const expr = es.getExpression();
            if (expr.isKind(SyntaxKind.CallExpression)) {
              const call = expr as CallExpression;
              if (call.getExpression().getText() === "super") {
                parseActorSuperCall(call, context);
              } else {
                addDiagnostic(ctor, context, 'warning', `Only super calls are allowed inside CActor constructors`);
              }
            }
          }
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
              t |= ESymbolType.array;
              break;

            default:
              let tText = type.getText();

              if (type.getText().endsWith('[]')) {
                t = ESymbolType.object | ESymbolType.array;
                tText = tText.slice(0, tText.length - 2);
              } else t = ESymbolType.object;

              const alias = context.typeAliases.get(tText);

              if (!alias) {
                addDiagnostic(ctor, context, 'error', `Undeclared type alias ${tText}`);
                return '';
              }

              children = getObjectTypeLayout(tText, context);
          }
          localCtx.paramMap[p.getName()] = { name: p.getName(), offset: i, type: t, children };
        });
        for (const st of statements) {
          code += indent(visitStatement(st, localCtx), 1);
        }
      }
    }
    return code;
  }