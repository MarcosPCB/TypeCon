import { VariableDeclaration, SyntaxKind, ObjectLiteralExpression, Expression, ArrowFunction, FunctionExpression } from "ts-morph";
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

const FP_ALIAS_BITS: Record<string, 8 | 12 | 16 | 30> = {
  FP8: 8, FP12: 12, FP16: 16, FP30: 30
};

export function visitVariableDeclaration(decl: VariableDeclaration, context: CompilerContext): string {
  const varName = decl.getName();

  let code = "";

  const type = decl.getType();

  const isGlobal = !context.curFunc && !context.curClass && !context.isInSubFunction;

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
          code += visitExpression(init as Expression, context);
        }
        context.curExpr = ESymbolType.number | ESymbolType.fixed_point;
        context.curFpBits = fpBits;
      } else {
        code += visitExpression(init as Expression, context);
        // FP value assigned to a plain-integer variable: truncate via shiftr
        if (fpBits === undefined && context.curFpBits !== 0) {
          code += `shiftr ra ${context.curFpBits}\n`;
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
        code += `set rsp _G_ADDR_${varName}\nsetarray flat[rsp] ra\n`;
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
        fp_bits: fpBits
      });
      context.localVarCount++;
    }



    context.localVarNativePointer = undefined;
    context.localVarNativePointerIndexed = false;
  }
  return code;
}