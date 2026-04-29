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
      } else code += visitExpression(init as Expression, context);
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
        global: true
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
      });
      context.localVarCount++;
    }



    context.localVarNativePointer = undefined;
    context.localVarNativePointerIndexed = false;
  }
  return code;
}