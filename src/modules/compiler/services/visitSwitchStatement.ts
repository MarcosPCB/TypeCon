import { SwitchStatement, SyntaxKind } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { indent } from "../helper/indent";
import { visitExpression } from "./visitExpression";
import { visitStatement } from "./visitStatement";

// Switches are turned into IF conditions
export function visitSwitchStatement(sw: SwitchStatement, context: CompilerContext) {
    let code = (context.options.lineDetail ? `/*${sw.getText()}*/\n` : '') + visitExpression(sw.getExpression(), context);
    const cases = sw.getCaseBlock().getClauses();
    const pastSwitch = context.inSwitch;
    if(context.usingRD)
      code += `state pushd\n`;

    if(pastSwitch)
      code += `set rd rsw\nstate pushd\nset rd rswc\nstate pushd\n`;
    else
      context.inSwitch = true;

    code += `set rsw ra\nset rswc -1\n`;
    code += `getcurraddress ra\nifn rswc -1 {\n`
    code += indent(`state pushb\nset rswe 0\n`, 1);
    for (let i = 0; i < cases.length; i++) {
      code += indent(`add rswc 1\n`, 1);
      const c = cases[i];
      if (c.isKind(SyntaxKind.DefaultClause))
        code += (context.options.lineDetail ? `/*${c.getText()}*/\n` : '') + indent(`ifge rswc ${cases.length}\n  set rswe 1\n`, 1);
      else {
        const clause = c.getExpression();
        
        code += context.options.lineDetail ? `/*${c.getText()}*/\n` : '';/* + indent(`state pushd\nstate pushc\n`, 1)*/
        code += indent(visitExpression(clause, context), 1);
        code += indent(`ife ra rsw\n  set rswe 1\n`, 1);
      }

      if(c.getStatements().length > 0) {
        code += `  ife rswe 1 {\n`;
        c.getStatements().forEach(e => code += indent(visitStatement(e, context), 2));
        code += `  }\n`;
      }
    }

    code += `  state popb\n}\ngetcurraddress rb\nife rswc -1 {\n  set rswc 0\n  jump ra\n}\n`;

    if(pastSwitch)
      code += `state popd\nset rswc rd\nstate popd\nset rsw rd\n`;
    else
      context.inSwitch = false;

    if(context.usingRD)
      code += `state popd\n`;

    return code;
  }