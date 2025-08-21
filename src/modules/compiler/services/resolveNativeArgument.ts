import { Expression, SyntaxKind, CallExpression, Identifier } from "ts-morph";
import { CompilerContext, ESymbolType, SegmentIdentifier, SegmentProperty, SymbolDefinition} from "../Compiler";
import { CON_NATIVE_FLAGS } from "../../../sets/TCSet100/native";
import { addDiagnostic } from "./addDiagnostic";
import { unrollMemberExpression } from "./unrollMemberExpression";
import { visitMemberExpression } from "./visitMemberExpression";

export function resolveNativeArgument(arg: Expression, expected: number, context: CompilerContext): string {
    // If expected type is LABEL:
    if (expected & CON_NATIVE_FLAGS.LABEL) {
      // If it's a call to Label, extract its argument:
      if (arg.isKind(SyntaxKind.CallExpression) && arg.getExpression().getText() === "Label") {
        const innerArgs = (arg as CallExpression).getArguments();
        if (innerArgs.length > 0) {
          return innerArgs[0].getText().replace(/[`'"]/g, "");
        } else {
          addDiagnostic(arg, context, "error", "Label() called without an argument");
          return "";
        }
      }
      // If it's a string literal, return its unquoted text.
      if (arg.isKind(SyntaxKind.StringLiteral)) {
        return arg.getText().replace(/[`'"]/g, "");
      }

      if(arg.isKind(SyntaxKind.NullKeyword))
        return '0';

      if(arg.isKind(SyntaxKind.Identifier)) {
        const vName = (arg as Identifier).getText();

        const sym = context.symbolTable.get(vName);

        if(!sym) {
          addDiagnostic(arg, context, 'error', `Variable ${vName} not declared`);
          return '';
        }

        if(!(sym.type & ESymbolType.pointer) && !(sym.type & ESymbolType.constant)) {
          addDiagnostic(arg, context, 'error', `Variable ${vName} is not a pointer/label type`);
          return '';
        }

        return sym.name;
      }

      if(arg.isKind(SyntaxKind.PropertyAccessExpression)) {
        const segments = unrollMemberExpression(arg);

        const obj = segments[0] as SegmentIdentifier;

        if(obj.name != 'this') {
          addDiagnostic(arg, context, 'error', `Action/Move/AI label/pointer cannot be outside of a class property declaration`);
        }

        let sym = context.symbolTable.get((segments[1] as SegmentIdentifier).name);

        if(!sym) {
          addDiagnostic(arg, context, 'error', `Variable ${(segments[1] as SegmentIdentifier).name} not declared`);
          return '';
        }

        for(let i = 1; i < segments.length; i++) {
          const seg = segments[i];
          if(seg.kind != 'property') {
              addDiagnostic(arg, context, 'error', `Segment ${seg.kind} is not allowed for pointer/label type`);
              return '';
          }

          if(sym.type & ESymbolType.object) {
            if(!sym.children) {
              addDiagnostic(arg, context, 'error', `Object ${sym.name} has no defined properties`);
              return '';
            }

            if(i == segments.length - 1) {
              addDiagnostic(arg, context, 'error', `Variable ${(segments[1] as SegmentIdentifier).name} is not a pointer/label type`);
              return '';
            }

            if(segments[i + 1].kind != 'property') {
              addDiagnostic(arg, context, 'error', `Segment ${segments[i + 1].kind} is not allowed for pointer/label type`);
              return '';
          }

            if(!sym.children[(segments[i + 1] as SegmentProperty).name]) {
              addDiagnostic(arg, context, 'error', `Property ${(segments[i + 1] as SegmentProperty).name} does not exist in ${sym.name} in ${arg.getText()}`);
              return '';
            }

            sym = sym.children[(segments[i + 1] as SegmentProperty).name] as SymbolDefinition;
            continue;
          }

          if(sym.type != (ESymbolType.pointer | ESymbolType.constant)) {
            addDiagnostic(arg, context, 'error', `Variable ${sym.name} is not a pointer/label type`);
            return '';
          }
        }

        return sym.name;
      }

      addDiagnostic(arg, context, "error", "Expected a label literal for a native LABEL argument");
      return "";
    }
    // If expected type is CONSTANT:
    if (expected & CON_NATIVE_FLAGS.CONSTANT) {
      if (arg.isKind(SyntaxKind.NumericLiteral)) {
        return arg.getText();
      }

      if (arg.isKind(SyntaxKind.PropertyAccessExpression) || arg.isKind(SyntaxKind.ElementAccessExpression))
        return visitMemberExpression(arg, context, false, true);

      if (arg.isKind(SyntaxKind.CallExpression) && arg.getExpression().getText() === "Label") {
        const innerArgs = (arg as CallExpression).getArguments();
        if (innerArgs.length > 0) {
          return innerArgs[0].getText().replace(/[`'"]/g, "");
        } else {
          addDiagnostic(arg, context, "error", "Label() called without an argument");
          return "";
        }
      }

      if(arg.isKind(SyntaxKind.PrefixUnaryExpression)) {
        const exp = arg.getOperand();
        const op = arg.getOperatorToken();

        if(!exp.isKind(SyntaxKind.NumericLiteral)) {
          addDiagnostic(arg, context, "error", `Expected a numeric constant for a native CONSTANT argument. Received: ${arg.getKindName()}`);
          return '';
        }

        if(op == SyntaxKind.MinusToken) {
          return `-${exp.getLiteralValue()}`;
        }
      }

      addDiagnostic(arg, context, "error", `Expected a numeric constant for a native CONSTANT argument. Received: ${arg.getKindName()}`);
      return "";
    }
    // For VARIABLE arguments, we assume that the value is loaded into a register already.
    return "";
  }