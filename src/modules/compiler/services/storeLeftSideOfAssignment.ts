import { Expression, SyntaxKind } from "ts-morph";
import { CompilerContext, SymbolDefinition, ESymbolType } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { findNativeVar_Sprite } from "../helper/helpers";
import { CON_NATIVE_TYPE } from "../../../sets/TCSet100/native";
import { visitMemberExpression } from "./visitMemberExpression";

export function storeLeftSideOfAssignment(left: Expression, context: CompilerContext, reg = 'ra'): string {
    let code = "";
    if (left.isKind(SyntaxKind.Identifier)) {
      const name = left.getText();
      if (name in context.paramMap) {
        addDiagnostic(left, context, "warning", `Assigning to param: ${name} => set rX ra`);
        code += `set r${context.paramMap[name].offset} ${reg}\n`;
        return code;
      }
      if (name in context.localVarOffset) {
        const off = context.localVarOffset[name];
        code += `set ri rbp\nsub ri ${off}\nsetarray flat[ri] ${reg}\n`;
        return code;
      }

      const v = context.symbolTable.get(name) as SymbolDefinition;

      if (v) {
        if (v.type & ESymbolType.native)
          return code + `set ${v.CON_code} ${reg}\n`;

        if (v.type & ESymbolType.quote)
          return code + `set ri rsbp\nadd ri ${v.offset}\nqstrcpy ri ${reg}\n`;

        code += `set ri rbp\nadd ri ${v.offset}\nsetarray flat[ri] ${reg}\n`;
        return code;
      }

      const native = findNativeVar_Sprite(name);

      if(native) {
        if(native.var_type == CON_NATIVE_TYPE.variable)
          return code + `set ${native.code} ${reg}\n`;
      }

      addDiagnostic(left, context, "error", `Assignment to unknown identifier: ${name}`);
      code += `set ${reg} 0\n`;
      return code;
    }

    if (left.isKind(SyntaxKind.PropertyAccessExpression) || left.isKind(SyntaxKind.ElementAccessExpression)) {
      code += `${reg != 'ra' ? `set ra ${reg}\n` : ''}` + visitMemberExpression(left, context, true, false);
      return code;
    }

    addDiagnostic(left, context, "error", `Unsupported left side: ${left.getText()}`);
    code += `set ${reg} 0\n`;
    return code;
  }