import { Expression, SyntaxKind, SpreadElement } from "ts-morph";
import { CompilerContext, ESymbolType, SymbolDefinition, EHeapType, CompilerOptions } from "../Compiler";
import { nativeVarsList, CON_NATIVE_TYPE } from "../../../sets/TCSet100/native";
import { pageSize } from "../framework";
import { findNativeVar_Sprite } from "../helper/helpers";
import { addDiagnostic } from "./addDiagnostic";
import { visitExpression } from "./visitExpression";

export function visitLeafOrLiteral(expr: Expression, context: CompilerContext, direct?: boolean, reg = 'ra'): string {
  let code = "";
  context.curSymRet = null;

  context.curExpr = ESymbolType.number;

  if (expr.isKind(SyntaxKind.Identifier)) {
    const name = expr.getText();
    // check param
    if (name in context.paramMap) {
      const i = context.paramMap[name];

      code += `set ${reg} r${i.offset}\n`;

      if (i.type & ESymbolType.string)
        context.curExpr = ESymbolType.string

      if (i.type & ESymbolType.array)
        context.curExpr |= ESymbolType.array

      return code;
    }

    if (nativeVarsList.includes(name)) {
      context.localVarNativePointer = name as any;
      return code;
    }

    /*// check local var
    if (name in context.localVarOffset) {
      const off = context.localVarOffset[name];
      code += `set ri rbp\nadd ri ${off}\nset ra flat[ri]\n`;
      return code;
    }*/

    if (context.symbolTable.has(name)) {
      const off = context.symbolTable.get(name) as SymbolDefinition;
      code += context.options.symbolPrint ? `/*Symbol ${JSON.stringify(off, undefined, 2)}*/\n` : '';
      if (off.type & ESymbolType.constant) {
        if (direct)
          return String(off.literal);

        return code + `set ${reg} ${off.literal}`;
      }

      if (off.type == ESymbolType.pointer) {
        if (direct)
          return String(off.literal);

        return code + `set ${reg} ${off.name}\n`;
      }

      if (off.type & ESymbolType.native)
        return code + `set ${reg} ${off.CON_code}\n`;

      code += `set ri rbp\nadd ri ${off.offset}\nset ${reg} flat[ri]\n`;
      if (off.type & ESymbolType.string)
        context.curExpr = ESymbolType.string;

      if (off.type & ESymbolType.array)
        context.curExpr |= ESymbolType.array;

      if (off.type & ESymbolType.sub_function)
        context.curExpr |= ESymbolType.sub_function | ESymbolType.function;

      if (off.heap)
        code += `set rf 1\n`;

      if (direct)
        return String(off.literal);

      return code;
    }

    const native = findNativeVar_Sprite(name);

    if (native) {
      if (native.var_type == CON_NATIVE_TYPE.variable) {
        if (direct)
          return native.code as string;

        return code + `set ${reg} ${native.code}\n`;
      }
    }
    // fallback => unknown
    addDiagnostic(expr, context, "error", `Unknown identifier: ${name}`);
    code += `set ${reg} 0\n`;
    return code;
  }

  if (expr.isKind(SyntaxKind.NumericLiteral)) {
    code += `set ${reg} ${expr.getText()}\n`;
    if (direct)
      return expr.getText();

    return code;
  }
  if (expr.isKind(SyntaxKind.StringLiteral) || expr.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
    let text = expr.getText().replace(/[`'"]/g, "");
    code += `state pushr2\nset r0 ${text.length + 1}\nset r1 ${EHeapType.string}\nstate alloc\nstate popr2\nsetarray flat[rb] ${text.length}\nset ri rb\n`;
    //code += `add rsp 1\nset rd rsp\nadd rsp 1\nsetarray flat[rsp] ${text.length}\n`;
    for (let i = 0; i < text.length; i++)
      code += `add ri 1\nsetarray flat[ri] ${text.charCodeAt(i)}\n`;

    context.curExpr = ESymbolType.string;

    if (reg != 'rb')
      code += `set ${reg} rb\n`;

    return code;
  }
  if (expr.isKind(SyntaxKind.TrueKeyword)) {
    code += `set ${reg} 1\n`;
    return code;
  }
  if (expr.isKind(SyntaxKind.FalseKeyword)) {
    code += `set ${reg} 0\n`;
    return code;
  }

  if (expr.isKind(SyntaxKind.ArrayLiteralExpression)) {
    const args = expr.getElements();

    context.curExpr |= ESymbolType.array;

    if (args.length == 0) {
      code += `state pushr2\nset r0 ${pageSize}\nset r1 ${EHeapType.array}\nstate alloc\nstate popr2\n${reg != 'rb' ? `set ${reg} rb\n` : ''}`;
      code += `setarray flat[rb] 0\n`; // Set size to 0
      return code;
    }

    // Start array construction
    code += `state pushr10\nset r10 0\n`; // r10 = accumulator for total size

    args.forEach((a) => {
      if (a.isKind(SyntaxKind.SpreadElement)) {
        // Visit the expression being spread (e.g. "arr1" in "...arr1")
        code += visitExpression((a as SpreadElement).getExpression(), context);
        code += `add rsp 1\nsetarray flat[rsp] ra\n`;
        code += `add r10 flat[ra]\n`;
      } else {
        code += visitExpression(a as Expression, context);
        code += `add rsp 1\nsetarray flat[rsp] ra\n`;
        code += `add r10 1\n`;
      }
    });

    // Allocate memory
    code += `state pushr2\nset r0 r10\nset r1 ${EHeapType.array}\nstate alloc\nstate popr2\n`;
    // rb = new array address
    code += `setarray flat[rb] r10\n`; // Store size

    // Populate (Reverse Order)
    // ri = current write position (end of array)
    code += `set ri rb\nadd ri r10\n`;

    // Iterate in reverse
    for (let i = args.length - 1; i >= 0; i--) {
      const a = args[i];
      if (a.isKind(SyntaxKind.SpreadElement)) {
        // Stack has array pointer
        code += `set rd flat[rsp]\nsub rsp 1\n`; // rd = source array pointer
        code += `set rc flat[rd]\n`; // rc = source array length

        // We need to copy rc elements from flat[rd+rc] down to flat[rd+1]
        // into flat[ri] down to flat[ri-rc+1]

        // Loop rc times
        code += `state pushr11\n`;
        // r11 = loop counter
        code += `set r11 rc\n`;
        code += `  whilel 0 r11 {\n`;
        // Read source: src_addr = rd + r11
        code += `    set r2 rd\n    add r2 r11\n    set ra flat[r2]\n`;
        // Write dest: dst_addr = ri (which tracks current high position)
        code += `    setarray flat[ri] ra\n`;
        // Decrement dest ptr
        code += `    sub ri 1\n`;
        // Decrement loop stats
        code += `    sub r11 1\n`;
        code += `  }\n`;
        code += `state popr11\n`;

      } else {
        // Stack has value
        code += `set ra flat[rsp]\nsub rsp 1\n`;
        code += `setarray flat[ri] ra\n`;
        code += `sub ri 1\n`;
      }
    }

    code += `set ra rb\n`; // Result is the new array pointer
    if (reg != 'ra') code += `set ${reg} ra\n`;

    code += `state popr10\n`;

    return code;
  }

  if (expr.isKind(SyntaxKind.AsExpression)) {
    code += visitExpression(expr.getExpression(), context);

    const asKind = expr.compilerNode.type.kind;

    if (asKind == SyntaxKind.StringLiteral
      || asKind == SyntaxKind.NoSubstitutionTemplateLiteral
      || asKind == SyntaxKind.StringKeyword)
      context.curExpr = ESymbolType.string;

    return code;
  }

  if (expr.isKind(SyntaxKind.NullKeyword)) {
    context.curExpr = ESymbolType.null;
    return code + `set ${reg} 0\n`;
  }

  if (expr.isKind(SyntaxKind.NewExpression)) {
    const className = expr.getExpression().getText();
    const sym = context.symbolTable.get(className);

    if (!sym) {
      addDiagnostic(expr, context, 'error', `Undeclared class ${className}`);
      return '';
    }

    if (sym.type != ESymbolType.class) {
      addDiagnostic(expr, context, 'error', `Only classes are supported by a New Expression: ${expr.getText()}`);
      return '';
    }

    const args = expr.getArguments();

    code += `state pushr${args.length > 12 ? 'all' : args.length}\n`
    args.forEach((a, i) => {
      code += visitExpression(a as Expression, context);
      code += `set r${i} ra\n`;
    });
    code += `state ${className}_constructor\nset ra rb\n`;
    code += `state popr${args.length > 12 ? 'all' : args.length}\n`;
    context.curExpr = ESymbolType.class;
    context.curSymRet = sym;
    return code;
  }

  addDiagnostic(expr, context, "error", `Unhandled leaf/literal: ${expr.getKindName()} - ${expr.getText()}`);
  code += `set ${reg} 0\n`;
  return code;
}