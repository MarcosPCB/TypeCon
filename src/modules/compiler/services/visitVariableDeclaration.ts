import { VariableDeclaration, SyntaxKind, ObjectLiteralExpression, PropertyAssignment, Expression, ArrowFunction, FunctionExpression } from "ts-morph";
import { CompilerContext, ESymbolType, SymbolDefinition } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { ECompileOptions } from "../framework";
import { getObjectTypeLayout } from "./getObjectLayout";
import { visitObjectLiteral } from "./visitObjectLiteral";
import { visitExpression } from "./visitExpression";
import { indent } from "../helper/indent";
import { visitArrowFunctionExpression } from "./visitArrowFunctionExpression";
import { createHash } from "crypto";
import { subFunctionInit } from "./subFunctionInit";
import { evaluateLiteralExpression } from "../helper/helpers";

const FP_ALIAS_BITS: Record<string, 11 | 14 | 16 | 30> = {
  FP11: 11, FP14: 14, FP16: 16, FP30: 30
};

export function visitVariableDeclaration(decl: VariableDeclaration, context: CompilerContext): string {
  const varName = decl.getName();

  let code = "";

  const type = decl.getType();

  const isGlobal = !context.curFunc && !context.curClass && !context.isInSubFunction;

  if (type && type.getAliasSymbol() && type.getAliasSymbol().getName() == 'gameVar') {
    const initNode = decl.getInitializer();
    const defaultValue = (initNode ? evaluateLiteralExpression(initNode, context) as number : undefined) ?? 0;
    const overrideValue = context.options?.varOverrides?.get(varName);
    const initValue = overrideValue !== undefined ? overrideValue : defaultValue;
    context.gameVarDeclarations.push(`gamevar ${varName} ${initValue} REG_FLAGS\n`);
    context.symbolTable.set(varName, {
      name: varName, type: ESymbolType.native, offset: 0, size: 1, CON_code: varName,
      global: true,
      parentFunc: undefined
    });
    return code;
  }

  if (type && type.getAliasSymbol() && type.getAliasSymbol().getName() == 'CON_NATIVE_GAMEVAR') {
    context.symbolTable.set(varName, {
      name: varName, type: ESymbolType.native, offset: 0, size: 1, CON_code: type.getAliasTypeArguments()[0].getText().replace(/[`'"]/g, ""),
      global: isGlobal,
      parentFunc: isGlobal ? undefined : context.curFunc?.name
    });
    return code;
  }

  if (type && type.getAliasSymbol() && type.getAliasSymbol().getName() == 'CON_CONSTANT') {
    context.symbolTable.set(varName, {
      name: varName,
      type: ESymbolType.number | ESymbolType.constant,
      offset: 0,
      size: 1,
      literal: type.getAliasTypeArguments()[0].getLiteralValue() as number,
      global: isGlobal,
      parentFunc: isGlobal ? undefined : context.curFunc?.name
    });
    return code;
  }

  if (type && type.getAliasSymbol() && type.getAliasSymbol().getName() == 'GameLabel') {
    const initNode = decl.getInitializer();
    const val = initNode ? evaluateLiteralExpression(initNode as Expression, context) as number : 0;
    context.headerDefines.push(`define ${varName} ${val}\n`);
    context.symbolTable.set(varName, {
      name: varName,
      type: ESymbolType.number | ESymbolType.constant,
      offset: 0,
      size: 1,
      literal: val,
      isLabel: true,
      global: isGlobal,
      parentFunc: isGlobal ? undefined : context.curFunc?.name
    });
    return code;
  }

  if (type && type.getAliasSymbol() && type.getAliasSymbol().getName() == 'Sound') {
    const initNode = decl.getInitializer();
    if (!initNode || !initNode.isKind(SyntaxKind.ObjectLiteralExpression)) {
      addDiagnostic(decl, context, 'error', 'Sound must be initialized with an object literal { file, ... }');
      return code;
    }
    const obj = initNode as ObjectLiteralExpression;

    let soundId: string | null = null;
    let soundFile = '';
    let pitchMin = 0, pitchMax = 0, flags = 0, dist = 0, vol = 0;

    for (const prop of obj.getProperties()) {
      if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;
      const pa = prop as PropertyAssignment;
      const propName = pa.getName();
      const propInit = pa.getInitializer();
      if (!propInit) continue;

      switch (propName) {
        case 'id': {
          if (propInit.isKind(SyntaxKind.Identifier)) {
            const sym = context.symbolTable.get(propInit.getText()) as SymbolDefinition;
            soundId = (sym?.isLabel) ? sym.name : String(evaluateLiteralExpression(propInit as Expression, context) ?? 0);
          } else {
            soundId = String(evaluateLiteralExpression(propInit as Expression, context) ?? 0);
          }
          break;
        }
        case 'file':
          soundFile = propInit.isKind(SyntaxKind.StringLiteral)
            ? (propInit as any).getLiteralText()
            : propInit.getText().replace(/^[`'"]|[`'"]$/g, '');
          break;
        case 'pitchMin':
          pitchMin = Number(evaluateLiteralExpression(propInit as Expression, context) ?? 0);
          break;
        case 'pitchMax':
          pitchMax = Number(evaluateLiteralExpression(propInit as Expression, context) ?? 0);
          break;
        case 'flags':
          flags = Number(evaluateLiteralExpression(propInit as Expression, context) ?? 0);
          break;
        case 'dist':
          dist = Number(evaluateLiteralExpression(propInit as Expression, context) ?? 0);
          break;
        case 'vol':
          vol = Number(evaluateLiteralExpression(propInit as Expression, context) ?? 0);
          break;
      }
    }

    if (!soundFile) {
      addDiagnostic(decl, context, 'error', `Sound '${varName}' is missing required field 'file'`);
      return code;
    }

    if (soundId === null) {
      // Auto-assign next available slot
      context.headerDefines.push(`define ${varName} ${context.soundSlotCounter}\n`);
      soundId = varName;
      context.soundSlotCounter++;
    }

    context.headerDefines.push(`definesound ${soundId} "${soundFile}" ${pitchMin} ${pitchMax} ${flags} ${dist} ${vol}\n`);
    context.symbolTable.set(varName, {
      name: varName,
      type: ESymbolType.number | ESymbolType.constant,
      offset: 0,
      size: 1,
      literal: context.soundSlotCounter - 1,
      isLabel: true,
      global: isGlobal,
      parentFunc: isGlobal ? undefined : context.curFunc?.name
    });
    return code;
  }

  if (type && type.getAliasSymbol()
    && (type.getAliasSymbol().getName() == 'CON_FUNC_ALIAS'
      || type.getAliasSymbol().getName() == 'CON_PROPERTY_ALIAS'))
    return code;

  if (type && type.getAliasSymbol() && type.getAliasSymbol().getName() == 'CON_NATIVE_OBJECT') {
    const alias = getObjectTypeLayout(type.getAliasTypeArguments()[0].getText().replace(/[`'"]/g, ""), context);
    if (!alias) {
      addDiagnostic(decl, context, 'error', `Undeclared type object ${type.getAliasTypeArguments()[0].getText()}`);
      return '';
    }
    context.symbolTable.set(varName, {
      name: varName, type: ESymbolType.native, offset: 0, size: 1, children: alias,
      global: isGlobal,
      parentFunc: isGlobal ? undefined : context.curFunc?.name
    });
    return code;
  }

  // ─── Fixed-point type detection ──────────────────────────────────────────
  // Use the explicit type annotation text (getTypeNode) rather than getAliasSymbol()
  // because alias resolution via getType() is unreliable in module-scoped files.
  const typeNodeText = decl.getTypeNode()?.getText();
  const fpBits = typeNodeText ? FP_ALIAS_BITS[typeNodeText] : undefined;

  // ─── Native Record<string, T> ─────────────────────────────────────────────
  if (typeNodeText?.startsWith('Record<')) {
    const valTypeStr = typeNodeText.match(/^Record<string,\s*(.+)>$/)?.[1]?.trim();
    const FP_BITS: Record<string, 11|14|16|30> = { FP11: 11, FP14: 14, FP16: 16, FP30: 30 };
    let recValType: ESymbolType = ESymbolType.number;
    let recFpBits: 11 | 14 | 16 | 30 | undefined;
    if (valTypeStr === 'boolean') recValType = ESymbolType.boolean;
    else if (valTypeStr === 'string') recValType = ESymbolType.string;
    else if (valTypeStr === 'object') recValType = ESymbolType.object;
    else if (FP_BITS[valTypeStr]) { recValType = ESymbolType.number | ESymbolType.fixed_point; recFpBits = FP_BITS[valTypeStr]; }

    // Conditional memory warning — skip in nocompile files (e.g. type-only declaration files)
    const s = context.options.stackSize  ?? 1024;
    const p = context.options.heapNumPages ?? 128;
    if ((s < 4096 || p < 256) && !(context.currentFile.options & ECompileOptions.no_compile))
      addDiagnostic(decl, context, 'warning',
        `Record requires substantial heap (stack_size=${s}, heap_page_number=${p}). ` +
        `Recommended: stack_size >= 4096, heap_page_number >= 256 in typecon.json.`);

    // If there's a non-literal initializer (e.g. r = someFunc()), use its result
    // instead of allocating a new empty Record.
    const recInit = decl.getInitializer();
    if (recInit && !recInit.isKind(SyntaxKind.ObjectLiteralExpression)) {
      code += visitExpression(recInit as Expression, context, 'rb');
    } else {
      // Allocate hash table (r0=0 → default capacity 16; rb = new ptr)
      code += `set r0 0\nstate _rec_alloc\n`;
    }

    if (isGlobal) {
      if (context.options.mode === 'module') {
        context.globalAllocations.push({ name: varName, size: 1 });
        code += `setarray flat[_G_ADDR_${varName}] rb\n`;
      } else {
        code += `setarray flat[${context.globalVarCount}] rb\n`;
      }
      context.symbolTable.set(varName, {
        name: varName, type: ESymbolType.record, offset: context.globalVarCount,
        size: 1, global: true,
        record_value_type: recValType as Exclude<ESymbolType, ESymbolType.enum>, record_value_fpbits: recFpBits
      });
      context.globalVarCount++;
    } else {
      code += `add rsp 1\nsetarray flat[rsp] rb\n`;
      context.symbolTable.set(varName, {
        name: varName, type: ESymbolType.record, offset: context.localVarCount,
        size: 1, global: false, parentFunc: context.curFunc?.name,
        record_value_type: recValType as Exclude<ESymbolType, ESymbolType.enum>, record_value_fpbits: recFpBits
      });
      context.localVarCount++;
    }
    return code;
  }

  const init = decl.getInitializer();
  if (init && init.isKind(SyntaxKind.ObjectLiteralExpression)) {
    code += visitObjectLiteral(init as ObjectLiteralExpression, context);

    if (context.currentFile.options & ECompileOptions.no_compile)
      return code;

    // We need to set the parentFunc to make it show up in Linker as a local variable
    const sym = context.symbolTable.get(varName);
    if (sym && sym.type !== ESymbolType.enum) {
      const s = sym as unknown as SymbolDefinition;
      s.global = isGlobal;
      if (!isGlobal && context.curFunc) {
        s.parentFunc = context.curFunc.name;
      }

      if (isGlobal) {
        if (context.options.mode === 'module') {
          context.globalAllocations.push({
            name: varName,
            size: s.size || 1
          });
        }
      }
    }

  } else {
    if (context.currentFile.options & ECompileOptions.no_compile)
      return code;

    // Process non-object initializers as before.
    if (init) {
      if (init.isKind(SyntaxKind.ArrowFunction) || init.isKind(SyntaxKind.FunctionExpression)) {
        subFunctionInit(init as ArrowFunction | FunctionExpression, context);
        code += `set ra ${context.subFunction.index * 100 + 0x10000}\n`;
        context.curExpr = ESymbolType.sub_function | ESymbolType.function;
      } else if (fpBits !== undefined) {
        // FP variable: convert numeric literals to fixed-point at compile time
        const litVal = evaluateLiteralExpression(init as Expression, context);
        if (typeof litVal === 'number') {
          code += `set ra ${Math.round(litVal * (1 << fpBits))}\n`;
        } else {
          // Propagate declared FP type as ambient context so literals and
          // sub-expressions inside the initializer know the target precision
          const prevDeclaredFp = context.declaredFpBits;
          context.declaredFpBits = fpBits;
          code += visitExpression(init as Expression, context);
          context.declaredFpBits = prevDeclaredFp;
          // Coerce result if expression returned a different FP precision
          if (context.curFpBits > 0 && context.curFpBits !== fpBits) {
            if (context.curFpBits > fpBits)
              code += `shiftr ra ${context.curFpBits - fpBits}\n`;
            else
              code += `shiftl ra ${fpBits - context.curFpBits}\n`;
          }
        }
        context.curExpr = ESymbolType.number | ESymbolType.fixed_point;
        context.curFpBits = fpBits;
      } else {
        code += visitExpression(init as Expression, context);
        // If curFpBits wasn't set (const FP identifier evaluated at compile time),
        // fall back to the symbol's declared fp_bits
        let rhsFp = context.curFpBits;
        if (rhsFp === 0 && (init as Expression).isKind(SyntaxKind.Identifier)) {
          const rhsSym = (context.symbolTable.get((init as Expression).getText()) ?? context.paramMap[(init as Expression).getText()]) as SymbolDefinition | undefined;
          if (rhsSym?.fp_bits) rhsFp = rhsSym.fp_bits;
        }
        // FP value assigned to a plain-integer variable: truncate via shiftr
        if (fpBits === undefined && rhsFp !== 0) {
          code += `shiftr ra ${rhsFp}\n`;
          context.curFpBits = 0;
        }
      }
    }

    if (fpBits !== undefined) {
      context.curExpr = ESymbolType.number | ESymbolType.fixed_point;
      context.curFpBits = fpBits;
    }

    if (isGlobal) {
      if (context.options.mode === 'module') {
        context.globalAllocations.push({
          name: varName,
          size: 1
        });
        // Use G_ADDR for initialization
        code += `setarray flat[_G_ADDR_${varName}] ra\n`;
      } else {
        // Absolute global offset
        code += `setarray flat[${context.globalVarCount}] ra\n`;
      }

      context.symbolTable.set(varName, {
        name: varName, type: context.curExpr,
        offset: context.globalVarCount, size: 1,
        native_pointer: context.localVarNativePointer,
        native_pointer_index: context.localVarNativePointerIndexed,
        children: context.curSymRet ? context.curSymRet.children : undefined,
        class_name: (context.curExpr & ESymbolType.class) ? context.curSymRet?.name : undefined,
        global: true,
        fp_bits: fpBits
      });

      context.globalVarCount++;
    } else {
      // Local variable (Stack)
      code += `add rsp 1\nsetarray flat[rsp] ra\n`;
      context.symbolTable.set(varName, {
        name: varName,
        type: context.curExpr,
        offset: context.localVarCount,
        parentFunc: context.curFunc ? context.curFunc.name : undefined,
        size: 1,
        native_pointer: context.localVarNativePointer,
        native_pointer_index: context.localVarNativePointerIndexed,
        global: false,
        children: context.curSymRet ? context.curSymRet.children : undefined,
        class_name: (context.curExpr & ESymbolType.class) ? context.curSymRet?.name : undefined,
        fp_bits: fpBits
      });
      context.localVarCount++;
    }



    context.localVarNativePointer = undefined;
    context.localVarNativePointerIndexed = false;
  }
  return code;
}