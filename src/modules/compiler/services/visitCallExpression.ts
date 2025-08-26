import { CallExpression, Expression, SyntaxKind, StringLiteral } from "ts-morph";
import { CompilerContext, ESymbolType, SymbolDefinition, EnumDefinition, SegmentProperty, SegmentIdentifier, SegmentIndex } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { findNativeFunction } from "../helper/helpers";
import { CON_NATIVE_FLAGS } from "../../../sets/TCSet100/native";
import { unrollMemberExpression } from "./unrollMemberExpression";
import { visitExpression } from "./visitExpression";
import { resolveNativeArgument } from "./resolveNativeArgument";

export function visitCallExpression(call: CallExpression, context: CompilerContext, reg = 'ra'): string {
    let code = context.options.lineDetail ? `/* ${call.getText()} */\n` : '';
    const args = call.getArguments();
    let resolvedLiterals: (string | null)[] = [];

    // Process each argument based on the expected native flag.
    const callExp = call.getExpression();
    let fnNameRaw = '';
    let fnObj: string | undefined;
    if (callExp.isKind(SyntaxKind.Identifier))
      fnNameRaw = call.getExpression().getText();
    else if (callExp.isKind(SyntaxKind.PropertyAccessExpression)
      || callExp.isKind(SyntaxKind.ElementAccessExpression)) {
      const segments = unrollMemberExpression(callExp);

      let obj = segments[0];

      if (obj.kind == 'this') {
        if (segments.length == 2 && segments[1].kind != 'index')
          fnNameRaw = segments[1].name;
        else //Special case for player class with actor property
          if(segments[1].kind == 'property' && segments[1].name == 'actor')
            fnNameRaw = (segments[2] as SegmentProperty).name;
        else {
          //Assume it's greater than 2
          //In this case, we know this is not a native function
          //Search in the context for any objects/classes that contain the function
          let o: SymbolDefinition | EnumDefinition;

          if (!context.curClass) {
            obj = segments[1] as SegmentProperty;
            o = context.symbolTable.get(obj.name);

            if (!o || !o.children) {
              addDiagnostic(call, context, 'error', `Invalid object ${obj.name}: ${fnNameRaw}`);
              return '';
            }
          } else o = context.curClass;

          for (let i = context.curClass ? 1 : 2; i < segments.length; i++) {
            if (segments[i].kind == 'index') {
              if (!(o.type & ESymbolType.array)) {
                addDiagnostic(call, context, 'error', `Invalid index at non-array ${o.name}: ${fnNameRaw}`);
                return '';
              }

              continue;
            }

            obj = segments[i] as SegmentProperty;
            if (!o.children[obj.name]) {
              addDiagnostic(call, context, 'error', `Invalid property ${obj.name}: ${fnNameRaw}`);
              return '';
            }

            o = o.children[obj.name] as SymbolDefinition;
            if (i != segments.length - 1) {
              if (o.type & ESymbolType.function) {
                //Function properties are not yet supported
                addDiagnostic(call, context, 'error', `Function properties are not yet supported: ${fnNameRaw}`);
                return '';
              }

              if (!(o.type & ESymbolType.object) && !(o.type & ESymbolType.array) && !(o.type & ESymbolType.module)) {
                addDiagnostic(call, context, 'error', `Invalid object ${obj.name}: ${fnNameRaw}`);
                return '';
              }

              continue;
            }

            //If got it here, than we found the function
            //If not native, assume it's a user function state.
            //TO-DO: SETUP THE STACK WITH THE HEAP ELEMENTS OF THE INSTANTIATED CLASS
            const isClass = (segments[0] as SegmentIdentifier).name == 'this' && context.curClass;
            const totalArgs = args.length + (isClass ? 1 : 0);

            if (args.length > 0) {
              code += `state pushr${totalArgs > 12 ? 'all' : totalArgs}\n`;
              context.localVarCount += totalArgs;
            }
            for (let i = 0; i < args.length; i++) {
              code += visitExpression(args[i] as Expression, context, `r${i}`);
              //code += `set r${i} ra\n`;
              resolvedLiterals.push(null);
            }

            if (isClass)
              code += `set r${totalArgs - 1} flat[rbp]\n`;

            code += `state ${o.name}\n`;
            if(o.returns)
              code += `${reg != 'rb' ? `set ${reg} rb\n` :  ''}`;
            if (totalArgs > 0) {
              code += `state popr${args.length > 12 ? 'all' : totalArgs}\n`;
              context.localVarCount -= args.length;
            }

            context.curExpr = o.returns;

            return code;
          }
        }
      } else if (segments[0].kind == 'identifier') {
        if (segments.length == 2 && segments[1].kind != 'index') {
          fnNameRaw = (segments[1] as SegmentProperty).name;
          fnObj = segments[0].name;
        } else {
          //Assume it's greater than 2
          //In this case, we know this is not a native function
          //Search in the context for any objects/classes that contain the function

          obj = segments[0] as SegmentIdentifier;

          let o = context.symbolTable.get(obj.name);

          if (!o || !o.children) {
            addDiagnostic(call, context, 'error', `Invalid object ${obj.name}: ${fnNameRaw}`);
            return '';
          }

          const isClass = Boolean(o.type & ESymbolType.class);

          for (let i = 1; i < segments.length; i++) {
            if (segments[i].kind == 'index') {
              if (!(o.type & ESymbolType.array)) {
                addDiagnostic(call, context, 'error', `Invalid index at non-array ${o.name}: ${fnNameRaw}`);
                return '';
              }

              continue;
            }

            obj = segments[i] as SegmentProperty;
            if (!o.children[obj.name]) {
              addDiagnostic(call, context, 'error', `Invalid property ${obj.name}: ${fnNameRaw}`);
              return '';
            }

            o = o.children[obj.name] as SymbolDefinition;
            if (i != segments.length - 1) {
              if (o.type & ESymbolType.function) {
                //Function properties are not yet supported
                addDiagnostic(call, context, 'error', `Function properties are not yet supported: ${fnNameRaw}`);
                return '';
              }

              if (!(o.type & ESymbolType.object) && !(o.type & ESymbolType.array) && !(o.type & ESymbolType.module)) {
                addDiagnostic(call, context, 'error', `Invalid object ${obj.name}: ${fnNameRaw}`);
                return '';
              }

              continue;
            }

            //If got it here, than we found the function
            //If not native, assume it's a user function state.
            //TO-DO: SETUP THE STACK WITH THE HEAP ELEMENTS OF THE INSTANTIATED CLASS
            const totalArgs = args.length + (isClass ? 1 : 0);
            const objSym = context.symbolTable.get((segments[0] as SegmentIdentifier).name) as SymbolDefinition;

            if (args.length > 0) {
              code += `state pushr${totalArgs > 12 ? 'all' : totalArgs}\n`;
              context.localVarCount += totalArgs;
            }
            for (let i = 0; i < args.length; i++) {
              code += visitExpression(args[i] as Expression, context, `r${i}`);
              //code += `set r${i} ra\n`;
              resolvedLiterals.push(null);
            }

            if (isClass)
              code += `set ri rbp\nadd ri ${objSym.offset}\nset r${totalArgs - 1} flat[ri]\n`;

            code += `state ${o.name}\n`
            if(o.returns)
              code += `${reg != 'rb' ? `set ${reg} rb\n` :  ''}`;
            if (totalArgs > 0) {
              code += `state popr${args.length > 12 ? 'all' : totalArgs}\n`;
              context.localVarCount -= args.length;
            }

            context.curExpr = o.returns;

            return code;
          }
        }
      }
    }

    if (fnNameRaw == 'CON' && !fnObj) {
      code += `//HAND-WRITTEN CODE
state push
state pushd
state pushc
${(args[0] as StringLiteral).getText().replace(/[`'"]/g, "")}
set rb ra
state popc
state popd
state pop
//END OF HAND-WRITTEN CODE
`
      return code;
    }

    if (fnNameRaw == 'CONUnsafe' && !fnObj) {
      code += `//HAND-WRITTEN UNSAFE CODE
${(args[0] as StringLiteral).getText().replace(/[`'"]/g, "")}
set rb ra
//END OF HAND-WRITTEN UNSAFE CODE
`
      return code;
    }

    if (fnNameRaw == 'Quote' && !fnObj) {
      if (args[0].isKind(SyntaxKind.StringLiteral)) {
        let text = args[0].getText().replace(/[`'"]/g, "");
        if (text.length > 128) {
          addDiagnostic(args[0], context, 'warning', `Quote length greater than 128, truncating...`);
          text = text.slice(0, 128);
        }
        code += `add rssp 1\nqputs 1023 ${text}\nqstrcpy rssp 1023\nset r${reg} rssp\n`;
        return code;
      } else {
        code += visitExpression(args[0] as Expression, context);
        code += `state pushr1\nset r0 ra\nstate _convertString2Quote\nstate popr1\n${reg != 'rb' ? `set ${reg} rb\n` :  ''}`
        return code;
      }
    }

    let variable = context.paramMap[fnObj];

    if (!variable)
      variable = context.symbolTable.get(fnObj) as SymbolDefinition;

    let typeName: undefined | string = undefined;

    //if (variable && (!(variable.type & ESymbolType.function) && !(variable.type & ESymbolType.array) && !(variable.type & ESymbolType.object)))
    if (variable) {
      if (variable.type & ESymbolType.array)
        typeName = 'array';
      else {
        if (variable.type & ESymbolType.string)
          typeName = 'string';
      }
    }

    const nativeFn = findNativeFunction(fnNameRaw, fnObj, typeName);
    if (nativeFn) {
      let argCode = '';
      let argsLen = 0;

      if (nativeFn.type_belong)
        argsLen += 2;

      if (args.length > 0) {
        nativeFn.arguments.forEach(e => {
          argsLen++;
          //if (e == CON_NATIVE_FLAGS.OBJECT || e == CON_NATIVE_FLAGS.ARRAY)
            //argsLen++;
        });
        code += `state pushr${argsLen > 12 ? 'all' : argsLen}\n`;
        context.localVarCount += argsLen;
      }

      let fnType = 0; //0 - string, 1 - arrow, 2 - string from array, 3 - arrow from array
      let optionalArgs = 0;

      for (let i = 0, j = 0; i < args.length; i++, j++) {
        const expected = nativeFn.arguments[i] ?? 0;
        // For LABEL and CONSTANT types, resolve to a literal.
        if (expected & (CON_NATIVE_FLAGS.LABEL | CON_NATIVE_FLAGS.CONSTANT) && !(expected & CON_NATIVE_FLAGS.OBJECT)) {
          const literal = resolveNativeArgument(args[i] as Expression, expected, context);
          resolvedLiterals.push(literal);
          // We do not emit register loads for these.
        } else if (expected & CON_NATIVE_FLAGS.STRING) {
          code += visitExpression(args[i] as Expression, context);
          if (!(context.curExpr & ESymbolType.string))
            code += `state pushr1\nset r0 ra\nstate _convertInt2String\nstate popr1\nset ra rb\n`

          code += `state pushr1\nset r0 ra\nstate _convertString2Quote\nstate popr1\nset r${j} rb\n`
          //code += `set r${j} ra\n`;
          resolvedLiterals.push(null);
        } else if (expected & CON_NATIVE_FLAGS.VARIABLE) {
          // For VARIABLE, generate code normally.
          code += visitExpression(args[i] as Expression, context, `r${i}`);
          //code += `set r${j} ra\n`;
          resolvedLiterals.push(null);
        } else if (expected & CON_NATIVE_FLAGS.FUNCTION) {
          // For FUNCTION, generate code normally and keep it at argCode
          argCode += visitExpression(args[i] as Expression, context);
          resolvedLiterals.push(null);
        } else if (expected & (CON_NATIVE_FLAGS.OBJECT | CON_NATIVE_FLAGS.ARRAY)) {
          code += visitExpression(args[i] as Expression, context, `r${i}`);
          resolvedLiterals.push(null);
        } else {
          code += visitExpression(args[i] as Expression, context, `r${i}`);
          //code += `set r${j} ra\n`;
          resolvedLiterals.push(null);
        }

        if(expected & CON_NATIVE_FLAGS.OPTIONAL)
          optionalArgs++;
      }

      if (nativeFn.type_belong) {
        code += `set ri rbp\nadd ri ${variable.offset}\nset r${argsLen - 2} flat[ri]\nset r${argsLen -1} ri\n`;
        if (nativeFn.type_belong.includes('string') && nativeFn.return_type == 'string')
          context.curExpr = ESymbolType.string;
      }

      if (nativeFn.return_type == 'array')
        context.curExpr |= ESymbolType.array;

      if (nativeFn.return_type == 'object')
        context.curExpr |= ESymbolType.object;

      // For simple native functions (code is a string), concatenate the command with the arguments.
      if (typeof nativeFn.code === "string") {
        code += nativeFn.code; // e.g., "rotatesprite "
        for (let i = 0; i < args.length; i++) {
          if (resolvedLiterals[i] !== null && resolvedLiterals[i] !== "") {
            code += " " + resolvedLiterals[i];
          } else {
            code += ` r${i}`;
          }
        }
        code += "\n";
        if (args.length > 0) {
          code += `state popr${argsLen > 12 ? 'all' : argsLen}\n`;
          context.localVarCount -= argsLen;
        }
      } else {
        // For complex functions, call the arrow function.
        let fnCode = '';
        if(resolvedLiterals.findIndex(e => typeof e !== 'string'))
          fnCode = (nativeFn.code as (constants: string[]) => string)(resolvedLiterals);
        else
          fnCode = (nativeFn.code as (args?: boolean, fn?: string) => string)(optionalArgs > 0, argCode);
        code += fnCode + "\n";
        if (args.length > 0) {
          code += `state popr${argsLen > 12 ? 'all' : argsLen}\n`;
          context.localVarCount -= argsLen;
        }
        if (nativeFn.return_type == 'object') {
          code += `set rd ${nativeFn.return_size}\nadd rsp 1\nset ri rsp\ncopy flat[rsp] flat[rb] rd\n`;
          code += `add rsp ${nativeFn.return_size - 1}\nset rb ri\n`
          context.localVarCount += nativeFn.return_size;
        }
      }
    } else {
      const fnName = fnNameRaw.startsWith("this.") ? fnNameRaw.substring(5) : fnNameRaw;
      const func = context.symbolTable.get(fnObj ? fnObj : fnName) as SymbolDefinition;

      if (!func) {
        addDiagnostic(call, context, 'error', `Invalid ${fnObj ? 'class/object' : 'function'} ${fnNameRaw}`);
        return '';
      }

      const isClass = Boolean(func.type & ESymbolType.class);
      const totalArgs = args.length + (isClass ? 1 : 0);

      if (isClass && (!func.children || (func.children && !func.children[fnName]))) {
        addDiagnostic(call, context, 'error', `Undefined method ${fnName} in class ${func.name}`)
        return '';
      }

      // If not native, assume it's a user function state
      if (totalArgs > 0) {
        code += `state pushr${totalArgs > 12 ? 'all' : totalArgs}\n`;
        context.localVarCount += totalArgs;
      }

      for (let i = 0; i < args.length; i++) {
        code += visitExpression(args[i] as Expression, context, `r${i}`);
        //code += `set r${i} ra\n`;
        resolvedLiterals.push(null);
      }

      if (isClass)
        code += `set ri rbp\nadd ri ${func.offset}\nset r${totalArgs - 1} flat[ri]\n`;

      code += `state ${isClass ? func.children[fnName].name : (func.CON_code ? func.CON_code : func.name)}\n${(reg != 'rb' && func.returns) ? `set ${reg} rb\n` :  ''}`;
      if (totalArgs > 0) {
        code += `state popr${totalArgs > 12 ? 'all' : totalArgs}\n`;
        context.localVarCount -= totalArgs;
      }

      context.curExpr = isClass ? (func.children[fnName] as SymbolDefinition).returns : func.returns;
    }

    if (nativeFn && nativeFn.returns) {
      code += `${reg != 'rb' ? `set ${reg} rb\n` :  ''}`;
    }

    return code;
  }