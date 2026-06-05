import { CallExpression, Expression, SyntaxKind, StringLiteral } from "ts-morph";
import { CompilerContext, ESymbolType, SymbolDefinition, EnumDefinition, SegmentProperty, SegmentIdentifier, SegmentIndex } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { findNativeFunction } from "../helper/helpers";
import { CON_NATIVE_FLAGS } from "../../../sets/TCSet100/native";
import { unrollMemberExpression } from "./unrollMemberExpression";
import { visitExpression } from "./visitExpression";
import { resolveNativeArgument } from "./resolveNativeArgument";
import { formatLineDetail } from "../helper/formatLineDetail";
import { fnv1a32 } from "../helper/fnv1a32";

// Read methods: key is only used for hash comparison, no string storage needed
const CRECORD_KEY_READ_METHODS  = new Set(['Get', 'GetType', 'Has']);
// Write methods: key string is stored in the slot (key_ptr), so string alloc still needed
const CRECORD_KEY_WRITE_METHODS = new Set(['Set']);

export function visitCallExpression(call: CallExpression, context: CompilerContext, reg = 'ra'): string {
  let code = context.options.lineDetail ? formatLineDetail(call.getText()) : '';
  const args = call.getArguments();
  let resolvedLiterals: (string | null)[] = [];

  // Process each argument based on the expected native flag.
  const callExp = call.getExpression();
  let fnNameRaw = '';
  let fnObj: string | undefined;
  let isThisDirectCall = false;
  if (callExp.isKind(SyntaxKind.Identifier))
    fnNameRaw = call.getExpression().getText();
  else if (callExp.isKind(SyntaxKind.PropertyAccessExpression)
    || callExp.isKind(SyntaxKind.ElementAccessExpression)) {
    const segments = unrollMemberExpression(callExp);

    let obj = segments[0];

    if (obj.kind == 'this') {
      if (segments.length == 2 && segments[1].kind != 'index') {
        fnNameRaw = segments[1].name;
        // this.method() call inside a class body — r0 must be set to self (flat[rbp])
        if (context.curClass) {
          fnObj = context.curClass.name;
          isThisDirectCall = true;
        }
      }
      else //Special case for player class with actor property
        if (segments[1].kind == 'property' && segments[1].name == 'actor')
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
            if (o.returns)
              code += `${reg != 'rb' ? `set ${reg} rb\n` : ''}`;
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
          if (o.returns)
            code += `${reg != 'rb' ? `set ${reg} rb\n` : ''}`;
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

  // Explicit FP precision casts: FP11(x), FP14(x), FP16(x), FP30(x)
  const FP_EXPLICIT_CAST: Record<string, 11 | 14 | 16 | 30> = { FP11: 11, FP14: 14, FP16: 16, FP30: 30 };
  if (FP_EXPLICIT_CAST[fnNameRaw] !== undefined && !fnObj && args.length === 1) {
    const targetBits = FP_EXPLICIT_CAST[fnNameRaw];
    context.nativeArgFpHint = targetBits;
    code += visitExpression(args[0] as Expression, context, reg);
    context.nativeArgFpHint = 0;
    const srcBits = context.curFpBits;
    if (srcBits > 0 && srcBits !== targetBits) {
      if (srcBits > targetBits)
        code += `shiftr ${reg} ${srcBits - targetBits}\n`;
      else
        code += `shiftl ${reg} ${targetBits - srcBits}\n`;
    } else if (srcBits === 0) {
      code += `shiftl ${reg} ${targetBits}\n`;
    }
    context.curFpBits = targetBits;
    return code;
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
      code += `state pushr1\nset r0 ra\nstate _convertString2Quote\nstate popr1\n${reg != 'rb' ? `set ${reg} rb\n` : ''}`
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
    let arg0FpBits = 0;

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
        // For i=0: evaluate directly into r0 (the standard accumulator path).
        // For i>0: evaluate into ra first, then move to r${i}. This ensures the
        // result always lands in the correct register — visitExpression sometimes
        // evaluates into ra without a final move when the target is r1, r2, etc.
        context.nativeArgFpHint = (nativeFn.arg_fp_bits?.[i] ?? 0) as (0 | 11 | 14 | 16 | 30);
        if (i === 0) {
          code += visitExpression(args[i] as Expression, context, `r0`);
        } else {
          code += visitExpression(args[i] as Expression, context, 'ra');
          code += `set r${i} ra\n`;
        }
        context.nativeArgFpHint = 0;
        // Auto-coerce downward when the argument carries more FP precision than declared.
        if (!nativeFn.fp_aware_code && !nativeFn.inherit_fp_bits) {
          const declaredFp = nativeFn.arg_fp_bits?.[i] ?? 0;
          if (context.curFpBits > declaredFp) {
            code += `shiftr r${i} ${context.curFpBits - declaredFp}\n`;
          }
        }
        resolvedLiterals.push(null);
      } else if (expected & CON_NATIVE_FLAGS.FUNCTION) {
        // For FUNCTION, generate code normally and keep it at argCode
        argCode += visitExpression(args[i] as Expression, context);
        resolvedLiterals.push(null);
      } else if (expected & (CON_NATIVE_FLAGS.OBJECT | CON_NATIVE_FLAGS.ARRAY)) {
        if (i > 0) {
          const n = i <= 12 ? i : 'all';
          code += `state pushr${n}\n`;
        }
        code += visitExpression(args[i] as Expression, context, `r${i}`);
        if (i > 0) {
          const n = i <= 12 ? i : 'all';
          code += `state popr${n}\n`;
        }
        resolvedLiterals.push(null);
      } else {
        if (i > 0) {
          const n = i <= 12 ? i : 'all';
          code += `state pushr${n}\n`;
        }
        code += visitExpression(args[i] as Expression, context, `r${i}`);
        if (i > 0) {
          const n = i <= 12 ? i : 'all';
          code += `state popr${n}\n`;
        }
        resolvedLiterals.push(null);
      }

      if (i === 0 && (nativeFn.fp_aware_code || nativeFn.inherit_fp_bits))
        arg0FpBits = context.curFpBits;

      if (expected & CON_NATIVE_FLAGS.OPTIONAL)
        optionalArgs++;
    }

    if (nativeFn.type_belong) {
      code += `set ri rbp\nadd ri ${variable.offset}\nset r${argsLen - 2} flat[ri]\nset r${argsLen - 1} ri\n`;
      if (nativeFn.type_belong.includes('string') && nativeFn.return_type == 'string')
        context.curExpr = ESymbolType.string;
    }

    // @DebugTest: inject counter update after args are in registers, before state call
    if (context.isDebugTest && (fnNameRaw === 'checkEq' || fnNameRaw === 'checkFpEq')) {
      code += `add _testCounter 4096\nife r1 r2\n  add _testCounter 1\n`;
    }

    if (nativeFn.return_type == 'array')
      context.curExpr |= ESymbolType.array;

    if (nativeFn.return_type == 'object')
      context.curExpr |= ESymbolType.object;

    if (nativeFn.return_type == 'string')
      context.curExpr |= ESymbolType.string;

    // Resolve the instruction string: fp_aware_code takes priority over code.
    if (nativeFn.fp_aware_code) {
      code += nativeFn.fp_aware_code(arg0FpBits) + "\n";
      if (args.length > 0) {
        code += `state popr${argsLen > 12 ? 'all' : argsLen}\n`;
        context.localVarCount -= argsLen;
      }
    } else if (typeof nativeFn.code === "string") {
      // For simple native functions (code is a string), concatenate the command with the arguments.
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
      if (resolvedLiterals.findIndex(e => typeof e !== 'string'))
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

    // Apply FP-bit tracking after the call.
    if (nativeFn.inherit_fp_bits)
      context.curFpBits = arg0FpBits as 0 | 11 | 14 | 16 | 30;
    else if (nativeFn.returns_fp_bits)
      context.curFpBits = nativeFn.returns_fp_bits;
    else
      context.curFpBits = 0;
  } else {
    const fnName = fnNameRaw.startsWith("this.") ? fnNameRaw.substring(5) : fnNameRaw;
    let func = context.symbolTable.get(fnObj ? fnObj : fnName) as SymbolDefinition;
    let isParamClass = false;
    // Fallback: method call on a class-typed function parameter
    if (!func && fnObj && context.paramMap[fnObj]) {
      func = context.paramMap[fnObj] as unknown as SymbolDefinition;
      isParamClass = Boolean(func.type & ESymbolType.class);
    }

    if (!func) {
      addDiagnostic(call, context, 'error', `Invalid ${fnObj ? 'class/object' : 'function'} ${fnNameRaw}`);
      return '';
    }

    const isClass = Boolean(func.type & ESymbolType.class);
    const isModule = Boolean(func.type & ESymbolType.module);
    const totalArgs = args.length + (isClass ? 1 : 0);

    if ((isClass || isModule) && (!func.children || (func.children && !func.children[fnName]))) {
      addDiagnostic(call, context, 'error', `Undefined method ${fnName} in ${isModule ? 'module' : 'class'} ${func.name}`)
      return '';
    }

    // If not native, assume it's a user function state
    if (totalArgs > 0) {
      code += `state pushr${totalArgs > 12 ? 'all' : totalArgs}\n`;
      context.localVarCount += totalArgs;
    }

    const targetSym = (isClass || isModule) ? func.children[fnName] as SymbolDefinition : func;

    // CRecord compile-time hash optimisation: pre-compute FNV-1a for string-literal keys.
    // r6 carries the hash into the method body (0 = compute at runtime from string ptr in r0).
    let crecordHashCode = '';
    let skipArg0ForHash = false;
    if (isClass && func.class_name === 'CRecord' && args.length > 0) {
      const isReadMethod  = CRECORD_KEY_READ_METHODS.has(fnName);
      const isWriteMethod = CRECORD_KEY_WRITE_METHODS.has(fnName);
      if (isReadMethod || isWriteMethod) {
        if (args[0].isKind(SyntaxKind.StringLiteral)) {
          const keyStr = (args[0] as StringLiteral).getLiteralText();
          const hash = fnv1a32(keyStr);
          crecordHashCode = `set r6 ${hash}\n`;
          if (isReadMethod) skipArg0ForHash = true; // No string ptr needed — hash in r6 is enough
        } else {
          crecordHashCode = `set r6 0\n`; // Signal method body to compute hash from string in r0
        }
      }
    }
    // Internal delegation calls (e.g. this.Get(key) from GetInt) always have runtime keys.
    // Must explicitly reset r6 to 0 to prevent stale hash from an outer optimised call leaking in.
    if (!isClass && func.parentClass === 'CRecord' && args.length > 0
        && (CRECORD_KEY_READ_METHODS.has(fnName) || CRECORD_KEY_WRITE_METHODS.has(fnName))) {
      crecordHashCode = `set r6 0\n`;
    }

    for (let i = 0; i < args.length; i++) {
      if (i === 0 && skipArg0ForHash) {
        resolvedLiterals.push(null);
        continue; // Hash injected via r6; skip heap string allocation for r0
      }
      code += visitExpression(args[i] as Expression, context, `r${i}`);
      resolvedLiterals.push(null);
      const actualFp = context.curFpBits;
      const expectedFp = targetSym.param_fp_bits?.[i] ?? 0;
      if (actualFp !== expectedFp) {
        if (actualFp === 0 && expectedFp !== 0) {
          addDiagnostic(call, context, 'warning', `Argument ${i}: integer auto-cast to FP${expectedFp}`);
          code += `shiftl r${i} ${expectedFp}\n`;
        } else if (actualFp !== 0 && expectedFp === 0) {
          addDiagnostic(call, context, 'warning', `Argument ${i}: FP${actualFp} auto-cast to integer`);
          code += `shiftr r${i} ${actualFp}\n`;
        } else {
          addDiagnostic(call, context, 'warning', `Argument ${i}: FP${actualFp} auto-coerced to FP${expectedFp}`);
          code += actualFp < expectedFp ? `shiftl r${i} ${expectedFp - actualFp}\n` : `shiftr r${i} ${actualFp - expectedFp}\n`;
        }
      }
    }

    if (isClass) {
      if (isParamClass) {
        // this-pointer is already in the parameter register r{func.offset}
        code += `set r${totalArgs - 1} r${func.offset}\n`;
      } else if (isThisDirectCall) {
        // this.method() — self pointer is always at flat[rbp] (frame slot 0)
        code += `set r${totalArgs - 1} flat[rbp]\n`;
      } else if (func.global) {
        const addr = context.options.mode === 'module'
          ? `_G_ADDR_${func.name}`
          : func.offset;
        code += `set r${totalArgs - 1} flat[${addr}]\n`;
      } else {
        code += `set ri rbp\nadd ri ${func.offset}\nset r${totalArgs - 1} flat[ri]\n`;
      }
    }
    code += crecordHashCode;

    if (func.type & ESymbolType.sub_function) {
      code += `state pushsi\nset rsi rbp\nadd rsi ${func.offset}\nset rsi flat[rsi]\n`;
      code += `state _subFunctions_${context.subFunction.hash}\nstate popsi\n${(reg != 'rb' && func.returns) ? `set ${reg} rb\n` : ''}`;
    } else code += `state ${(isClass || isModule) ? func.children[fnName].name : (func.CON_code ? func.CON_code : func.name)}\n${(reg != 'rb' && targetSym.returns) ? `set ${reg} rb\n` : ''}`;
    if (totalArgs > 0) {
      code += `state popr${totalArgs > 12 ? 'all' : totalArgs}\n`;
      context.localVarCount -= totalArgs;
    }

    context.curExpr = (isClass || isModule) ? (func.children[fnName] as SymbolDefinition).returns : func.returns;
    context.curFpBits = targetSym.returns_fp_bits ?? 0;
    if ((context.curExpr & ESymbolType.class) && targetSym.returns_class_name) {
      context.curSymRet = context.symbolTable.get(targetSym.returns_class_name) as SymbolDefinition;
    }
  }

  if (nativeFn && nativeFn.returns) {
    code += `${reg != 'rb' ? `set ${reg} rb\n` : ''}`;
  }

  return code;
}