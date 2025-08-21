import { Node } from "ts-morph";
import { CompilerContext, DiagnosticSeverity } from "../Compiler";

export function addDiagnostic(
  node: Node,
  context: CompilerContext,
  severity: DiagnosticSeverity,
  message: string
) {
  context.diagnostics.push({
    line: node.getStartLineNumber(),
    message,
    severity
  });
}
