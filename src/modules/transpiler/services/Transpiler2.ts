/****************************************************************************
 * Transpiler.ts
 *
 * Demonstration of a TypeScript->CON transpiler using ts-morph, referencing:
 *   - native functions & variables from your 'native.ts' style definitions
 *   - skipping constructor code for CActor/CEvent
 *   - generating `useractor ...` in main()
 *   - local variable => delta-based stack usage
 ****************************************************************************/

import {
    Project,
    Node,
    SyntaxKind,
    Statement,
    Expression,
    Block,
    VariableStatement,
    VariableDeclaration,
    FunctionDeclaration,
    ClassDeclaration,
    ConstructorDeclaration,
    MethodDeclaration,
    IfStatement,
    ExpressionStatement,
    ReturnStatement,
    BinaryExpression,
    CallExpression,
    ObjectLiteralExpression,
    PropertyAccessExpression,
    ElementAccessExpression,
    PrefixUnaryExpression,
    PostfixUnaryExpression,
    ParenthesizedExpression,
    StatementedNode,
    TypeAliasDeclaration,
    TypeLiteralNode,
    PropertySignature,
    PropertyAssignment
  } from "ts-morph";
  
  // Import your native data
  import {
    CON_NATIVE_FLAGS,
    nativeFunctions,
    EMoveFlags,
    CON_NATIVE_FUNCTION,
    CON_NATIVE_TYPE,
    nativeVars_Sprites,
    CON_NATIVE_VAR,
    nativeVars_Sectors
  } from "../../../defs/TCSet100/native";

  import { Names } from "../types";
  
  // Also ensure you have your global type declarations from "types.ts"
  import "../../../defs/TCSet100/types";
import { evalMoveFlags, findNativeFunction, findNativeVar_Sprite } from "../helper/helpers";
  
  // We can define the local structures for diagnostics, context, etc.
  // This is a demonstration. Refine it as needed.
  
  type DiagnosticSeverity = "error" | "warning";

  type IfCondition =
  | { op: "ifand" | "ifeither" | "ifneither" | "ife" | "ifn" | "ifl" | "ifg" | "ifle" | "ifge"; left: Expression; right: Expression | number };

  
  interface TranspileDiagnostic {
    line: number;
    message: string;
    severity: DiagnosticSeverity;
  }
  
  interface TranspilerOptions {
    debug?: boolean;
  }

  interface SymbolDefinition {
    name: string;
    type: "number" | "string" | "object" | "array" | "pointer";
    offset: number;        // Delta from the object's base pointer.
    size?: number;         // How many slots this symbol occupies.
    children?: { [key: string]: SymbolDefinition }; // For nested objects.
  }
  
  interface TypeAliasDefinition {
    name: string;
    members: Record<string, string>; // property name -> type (as a string)
  }

  /** 
   * The transpiler context, storing local var offsets, param maps, 
   * plus info about CActor if we are in one, etc.
   */
  export interface TranspilerContext {
    localVarOffset: Record<string, number>;
    localVarCount: number;
    paramMap: Record<string, number>;
  
    diagnostics: TranspileDiagnostic[];
  
    options: TranspilerOptions;
  
    // For CActor:
    currentActorPicnum?: number;
    currentActorExtra?: number;
    currentActorIsEnemy?: boolean;
    currentActorFirstAction?: string;
    currentActorActions: string[];
    currentActorMoves: string[];
    currentActorAis: string[];
  
    // For event classes if needed
    currentEventName?: string;

    // New field to store type aliases:
    typeAliases: Map<string, TypeAliasDefinition>;

    // New symbol table for object layouts (global or per–scope)
    symbolTable: Map<string, SymbolDefinition>;
  }
  
  interface TranspileResult {
    conOutput: string;
    diagnostics: TranspileDiagnostic[];
  }
  
  /******************************************************************************
   * HELPER: addDiagnostic
   *****************************************************************************/
  export function addDiagnostic(
    node: Node,
    context: TranspilerContext,
    severity: DiagnosticSeverity,
    message: string
  ) {
    context.diagnostics.push({
      line: node.getStartLineNumber(),
      message,
      severity
    });
  }
  
  /******************************************************************************
   * INDENT UTILITY
   *****************************************************************************/
  function indent(text: string, level: number): string {
    const pad = "  ".repeat(level);
    return text
      .split("\n")
      .map(line => (line.trim() ? pad + line : line))
      .join("\n");
  }
  
  /******************************************************************************
   * MAIN TRANSPILER CLASS
   *****************************************************************************/
  export class TsToConTranspiler {
    private project: Project;
    private options: TranspilerOptions;
  
    constructor(options: TranspilerOptions = {}) {
      this.options = options;
      this.project = new Project({ useInMemoryFileSystem: true });
    }
  
    public transpile(sourceCode: string): TranspileResult {
      const sf = this.project.createSourceFile("temp.ts", sourceCode, {
        overwrite: true
      });
  
      const context: TranspilerContext = {
        localVarOffset: {},
        localVarCount: 0,
        paramMap: {},
        diagnostics: [],
        options: this.options,
  
        currentActorPicnum: undefined,
        currentActorExtra: undefined,
        currentActorIsEnemy: undefined,
        currentActorFirstAction: undefined,
        currentActorActions: [],
        currentActorMoves: [],
        currentActorAis: [],
        currentEventName: undefined,
        typeAliases: new Map(),
        symbolTable: new Map()
      };
  
      const outputLines: string[] = [];
  
      sf.getStatements().forEach(st => {
        if (st.isKind(SyntaxKind.FunctionDeclaration)) {
          outputLines.push(this.visitFunctionDeclaration(st as FunctionDeclaration, context));
        } else if (st.isKind(SyntaxKind.ClassDeclaration)) {
          outputLines.push(this.visitClassDeclaration(st as ClassDeclaration, context));
        } else {
          outputLines.push(this.visitStatement(st, context));
        }
      });
  
      return {
        conOutput: outputLines.join("\n"),
        diagnostics: context.diagnostics
      };
    }

    private storeTypeAlias(ta: TypeAliasDeclaration, context: TranspilerContext): void {
        const aliasName = ta.getName();
        const typeNode = ta.getTypeNode();
        if (!typeNode || typeNode.getKind() !== SyntaxKind.TypeLiteral) {
          addDiagnostic(ta, context, "warning", `Type alias ${aliasName} is not a literal type.`);
          return;
        }
        const typeLiteral = typeNode as TypeLiteralNode;
        const members: Record<string, string> = {};
        typeLiteral.getMembers().forEach(member => {
          if (member.getKind() === SyntaxKind.PropertySignature) {
            const prop = member as PropertySignature;
            members[prop.getName()] = prop.getType().getText();
          }
        });
        context.typeAliases.set(aliasName, { name: aliasName, members });
      }

      private getObjectSize(typeName: string, context: TranspilerContext): number {
        // If typeName is defined as a type alias, compute its size by summing the sizes of its members.
        if (context.typeAliases.has(typeName)) {
          const typeDef = context.typeAliases.get(typeName)!;
          let size = 0;
          for (const t of Object.values(typeDef.members)) {
            // If the member is an array type (e.g., "wow[]")
            if (t.endsWith("[]")) {
              // Strip the brackets to get the base type.
              const baseType = t.slice(0, -2).trim();
              // Recursively compute the size for one element of the array.
              if (context.typeAliases.has(baseType)) {
                size += this.getObjectSize(baseType, context);
              } else {
                // For primitive arrays, assume one slot per element.
                size += 1;
              }
            } else if (context.typeAliases.has(t)) {
              // If the member itself is a user-defined object, compute its size recursively.
              size += this.getObjectSize(t, context);
            } else {
              // Otherwise, assume a primitive type takes one slot.
              size += 1;
            }
          }
          return size;
        }
        // If the type is not defined as a type alias, assume it is primitive and occupies 1 slot.
        return 1;
      }
      
      
      private getArraySize(initText: string): number {
        // Example: if initializer is Array(4) then return 4.
        const match = initText.match(/Array\((\d+)\)/);
        return match ? parseInt(match[1], 10) : 0;
      }
  
    /******************************************************************************
     * visitStatement
     *****************************************************************************/
    private visitStatement(stmt: Statement, context: TranspilerContext): string {
      let code = `/* ${stmt.getText()} */\n`;
      switch (stmt.getKind()) {
        case SyntaxKind.VariableStatement:
          return code + this.visitVariableStatement(stmt as VariableStatement, context);
  
        case SyntaxKind.ExpressionStatement:
          return code + this.visitExpressionStatement(stmt as ExpressionStatement, context);
  
        case SyntaxKind.ReturnStatement:
          return code + this.visitReturnStatement(stmt as ReturnStatement, context);
  
        case SyntaxKind.IfStatement:
          return code + this.visitIfStatement(stmt as IfStatement, context);

        case SyntaxKind.TypeAliasDeclaration:
            this.storeTypeAlias(stmt as TypeAliasDeclaration, context);
            break;
  
        default:
          addDiagnostic(stmt, context, "warning", `Unhandled statement kind: ${stmt.getKindName()}`);
          return code;
      }
    }
  
    /******************************************************************************
     * variable statements => local var
     *****************************************************************************/
    private visitVariableStatement(node: VariableStatement, context: TranspilerContext): string {
      let code = "";
      const decls = node.getDeclarationList().getDeclarations();
      for (const d of decls) {
        code += this.visitVariableDeclaration(d, context);
      }
      return code;
    }
  
    private visitVariableDeclaration(decl: VariableDeclaration, context: TranspilerContext): string {
        const varName = decl.getName();
        let code = "";
      
        const init = decl.getInitializer();
        if (init && init.isKind(SyntaxKind.ObjectLiteralExpression)) {
          code += this.visitObjectLiteral(init as ObjectLiteralExpression, context);
          // Store in symbol table that varName is an object.
          const aliasName = this.getTypeAliasNameForObjectLiteral(init as ObjectLiteralExpression);
          const size = aliasName ? this.getObjectSize(aliasName, context) : 0;
          //context.symbolTable.set(varName, { name: varName, type: "object", offset: 0, size: size });
        } else {
          // Process non-object initializers as before.
          code += this.visitExpression(init as Expression, context);
          code += `add rsp 1\nset stack[rsp] ra\n`;
          context.symbolTable.set(varName, { name: varName, type: "number", offset: context.localVarCount + 1, size: 1 });
          context.localVarCount++;
        }
        return code;
      }
      
  
    /******************************************************************************
     * expression statement => just visit expression
     *****************************************************************************/
    private visitExpressionStatement(stmt: ExpressionStatement, context: TranspilerContext): string {
      return this.visitExpression(stmt.getExpression(), context);
    }
  
    /******************************************************************************
     * return => evaluate => set rb ra
     *****************************************************************************/
    private visitReturnStatement(rs: ReturnStatement, context: TranspilerContext): string {
      let code = "";
      const expr = rs.getExpression();
      if (expr) {
        code += this.visitExpression(expr, context);
        code += `set rb ra\n`;
      } else {
        code += `set rb 0\n`;
      }
      code += `// end function\n`;
      return code;
    }
  
    /******************************************************************************
     * if => must be (A && B), (A || B), or !(A || B)
     *****************************************************************************/
    private visitIfStatement(is: IfStatement, context: TranspilerContext): string {
        let code = "";
        const pattern = this.parseIfCondition(is.getExpression(), context);
        const thenPart = this.visitBlockOrStmt(is.getThenStatement(), context);
        const elsePart = is.getElseStatement() ? this.visitBlockOrStmt(is.getElseStatement()!, context) : "";
      
        if (!pattern) {
          code += `// invalid if condition fallback\nset rd 0\nset ra 1\nifand rd ra {\n${indent(thenPart, 1)}\n} else {\n${indent(elsePart, 1)}\n}\n`;
          return code;
        }
      
        // Evaluate left side normally
        code += this.visitExpression(pattern.left, context);
        code += `set rd ra\n`;
        
        // For the right side, check if it's a number or an Expression.
        if (typeof pattern.right === "number") {
          code += `set ra ${pattern.right}\n`;
        } else {
          code += this.visitExpression(pattern.right, context);
        }
      
        code += `${pattern.op} rd ra {\n`;
        code += indent(thenPart, 1) + "\n";
        code += `} else {\n`;
        code += indent(elsePart, 1) + "\n";
        code += `}\n`;
        return code;
      }
      
  
    private visitBlockOrStmt(s: Statement, context: TranspilerContext): string {
      if (s.isKind(SyntaxKind.Block)) {
        const blk = s as Block;
        return blk.getStatements().map(st => this.visitStatement(st, context)).join("\n");
      }
      return this.visitStatement(s, context);
    }
  
    private parseIfCondition(expr: Expression, context: TranspilerContext): IfCondition | undefined {
        if (expr.isKind(SyntaxKind.BinaryExpression)) {
          const bin = expr as BinaryExpression;
          const op = bin.getOperatorToken().getText();
          if (op === "&&") {
            return { op: "ifand", left: bin.getLeft(), right: bin.getRight() };
          }
          if (op === "||") {
            return { op: "ifeither", left: bin.getLeft(), right: bin.getRight() };
          }
          const mapping: Record<string, "ife" | "ifn" | "ifl" | "ifg" | "ifle" | "ifge"> = {
            "==": "ife",
            "!=": "ifn",
            "<": "ifl",
            ">": "ifg",
            "<=": "ifle",
            ">=": "ifge"
          };
          if (mapping[op]) {
            return { op: mapping[op], left: bin.getLeft(), right: bin.getRight() };
          }
          addDiagnostic(expr, context, "error", `if condition must be (A&&B), (A||B), a comparison, or a function call. Found operator "${op}"`);
          return undefined;
        }
        if (expr.isKind(SyntaxKind.CallExpression)) {
          const callExpr = expr as CallExpression;
          const fnName = callExpr.getExpression().getText();
          const nativeFn = findNativeFunction(fnName);
          if (nativeFn && nativeFn.returns && nativeFn.return_type === "variable") {
            // Instead of fabricating a fake Expression, simply return 1 as the expected boolean value.
            return { op: "ife", left: callExpr, right: 1 };
          } else {
            addDiagnostic(expr, context, "error", `Native function call ${fnName} not allowed or not returning a boolean value`);
            return undefined;
          }
        }
        if (expr.isKind(SyntaxKind.PrefixUnaryExpression)) {
          const pre = expr as PrefixUnaryExpression;
          if (pre.getOperatorToken() === SyntaxKind.ExclamationToken) {
            const sub = pre.getOperand();
            if (sub.isKind(SyntaxKind.BinaryExpression)) {
              const bin = sub as BinaryExpression;
              if (bin.getOperatorToken().getText() === "||") {
                return { op: "ifneither", left: bin.getLeft(), right: bin.getRight() };
              }
            }
            addDiagnostic(expr, context, "error", `if condition must be in the form !(A || B). Found something else.`);
            return undefined;
          }
        }
        addDiagnostic(expr, context, "error", `Unrecognized if condition. Must be (A&&B), (A||B), a comparison, or a function call.`);
        return undefined;
      }
      
  
    /******************************************************************************
     * Expression
     *****************************************************************************/
    private visitExpression(expr: Expression, context: TranspilerContext): string {
      let code = `/* ${expr.getText()} */\n`;
  
      switch (expr.getKind()) {
        case SyntaxKind.BinaryExpression:
          return code + this.visitBinaryExpression(expr as BinaryExpression, context);
  
        case SyntaxKind.CallExpression:
          return code + this.visitCallExpression(expr as CallExpression, context);
  
        case SyntaxKind.ObjectLiteralExpression:
          return code + this.visitObjectLiteral(expr as ObjectLiteralExpression, context);
  
        case SyntaxKind.PropertyAccessExpression:
        case SyntaxKind.ElementAccessExpression:
          return code + this.visitMemberExpression(expr, context);
  
        case SyntaxKind.PrefixUnaryExpression:
        case SyntaxKind.PostfixUnaryExpression:
          return code + this.visitUnaryExpression(expr, context);
  
        case SyntaxKind.ParenthesizedExpression:
          return code + this.visitParenthesizedExpression(expr as ParenthesizedExpression, context);
  
        default:
          return code + this.visitLeafOrLiteral(expr, context);
      }
    }
  
    private visitLeafOrLiteral(expr: Expression, context: TranspilerContext): string {
      let code = "";
  
      if (expr.isKind(SyntaxKind.Identifier)) {
        const name = expr.getText();
        // check param
        if (name in context.paramMap) {
          const i = context.paramMap[name];
          code += `set ra r${i}\n`;
          return code;
        }
        // check local var
        if (name in context.localVarOffset) {
          const off = context.localVarOffset[name];
          code += `set ri rsp\nsub ri ${off}\nset ra stack[ri]\n`;
          return code;
        }
        // fallback => unknown
        addDiagnostic(expr, context, "warning", `Unknown identifier: ${name}`);
        code += `set ra 0\n`;
        return code;
      }
  
      if (expr.isKind(SyntaxKind.NumericLiteral)) {
        code += `set ra ${expr.getText()}\n`;
        return code;
      }
      if (expr.isKind(SyntaxKind.StringLiteral)) {
        code += `set ra ${expr.getText().replace(/['"]/g, "")}\n`;
        return code;
      }
      if (expr.isKind(SyntaxKind.TrueKeyword)) {
        code += `set ra 1\n`;
        return code;
      }
      if (expr.isKind(SyntaxKind.FalseKeyword)) {
        code += `set ra 0\n`;
        return code;
      }
  
      addDiagnostic(expr, context, "error", `Unhandled leaf/literal: ${expr.getKindName()}`);
      code += `set ra 0\n`;
      return code;
    }
  
    private visitBinaryExpression(bin: BinaryExpression, context: TranspilerContext): string {
      const left = bin.getLeft();
      const right = bin.getRight();
      const opText = bin.getOperatorToken().getText();
  
      let code = `// binary: ${left.getText()} ${opText} ${right.getText()}\n`;
  
      const forbidden = ["<", ">", "<=", ">=", "==", "!=", "&&", "||"];
      if (forbidden.includes(opText)) {
        addDiagnostic(bin, context, "error", `Operator "${opText}" not allowed in normal expressions`);
        code += `set ra 0\n`;
        return code;
      }
  
      if (opText === "=") {
        // assignment
        code += this.visitExpression(right, context);
        code += this.storeLeftSideOfAssignment(left, context);
        return code;
      }
  
      code += this.visitExpression(left, context);
      code += `set rd ra\n`;
      code += this.visitExpression(right, context);
  
      switch (opText) {
        case "+":
          code += `add rd ra\nset ra rd\n`;
          break;
        case "-":
          code += `sub rd ra\nset ra rd\n`;
          break;
        case "*":
          code += `mul rd ra\nset ra rd\n`;
          break;
        case "/":
          code += `div rd ra\nset ra rd\n`;
          break;
        case "%":
          code += `mod rd ra\nset ra rd\n`;
          break;
        case "and":
          code += `and rd ra\nset ra rd\n`;
          break;
        case "or":
          code += `or rd ra\nset ra rd\n`;
          break;
        case "xor":
          code += `xor rd ra\nset ra rd\n`;
          break;
        default:
          addDiagnostic(bin, context, "error", `Unhandled operator "${opText}"`);
          code += `set ra 0\n`;
      }
  
      return code;
    }
  
    private storeLeftSideOfAssignment(left: Expression, context: TranspilerContext): string {
      let code = "";
      if (left.isKind(SyntaxKind.Identifier)) {
        const name = left.getText();
        if (name in context.paramMap) {
          addDiagnostic(left, context, "warning", `Assigning to param: ${name} => set rX ra`);
          code += `set r${context.paramMap[name]} ra\n`;
          return code;
        }
        if (name in context.localVarOffset) {
          const off = context.localVarOffset[name];
          code += `set ri rsp\nsub ri ${off}\nset stack[ri] ra\n`;
          return code;
        }
        addDiagnostic(left, context, "error", `Assignment to unknown identifier: ${name}`);
        code += `set ra 0\n`;
        return code;
      }
  
      if (left.isKind(SyntaxKind.PropertyAccessExpression) || left.isKind(SyntaxKind.ElementAccessExpression)) {
        // e.g. this.vel = ...
        addDiagnostic(left, context, "warning", `Assigning to property => handle with native var logic etc.`);
        code += `/* partial assign property placeholder */\nset ra 0\n`;
        return code;
      }
  
      addDiagnostic(left, context, "error", `Unsupported left side: ${left.getText()}`);
      code += `set ra 0\n`;
      return code;
    }

    private resolveNativeArgument(arg: Expression, expected: number, context: TranspilerContext): string {
        // If expected type is LABEL:
        if (expected & CON_NATIVE_FLAGS.LABEL) {
          // If it's a call to Label, extract its argument:
          if (arg.isKind(SyntaxKind.CallExpression) && arg.getExpression().getText() === "Label") {
            const innerArgs = (arg as CallExpression).getArguments();
            if (innerArgs.length > 0) {
              return innerArgs[0].getText().replace(/['"]/g, "");
            } else {
              addDiagnostic(arg, context, "error", "Label() called without an argument");
              return "";
            }
          }
          // If it's a string literal, return its unquoted text.
          if (arg.isKind(SyntaxKind.StringLiteral)) {
            return arg.getText().replace(/['"]/g, "");
          }
          addDiagnostic(arg, context, "error", "Expected a label literal for a native LABEL argument");
          return "";
        }
        // If expected type is CONSTANT:
        if (expected & CON_NATIVE_FLAGS.CONSTANT) {
          if (arg.isKind(SyntaxKind.NumericLiteral)) {
            return arg.getText();
          }
          addDiagnostic(arg, context, "error", "Expected a numeric constant for a native CONSTANT argument");
          return "";
        }
        // For VARIABLE arguments, we assume that the value is loaded into a register already.
        return "";
      }
      
  
      private visitCallExpression(call: CallExpression, context: TranspilerContext): string {
        let code = `/* ${call.getText()} */\n`;
        const args = call.getArguments();
        let resolvedLiterals: (string | null)[] = [];
      
        // Process each argument based on the expected native flag.
        const fnNameRaw = call.getExpression().getText();
        const nativeFn = findNativeFunction(fnNameRaw);
        if (nativeFn) {
          for (let i = 0; i < args.length; i++) {
            const expected = nativeFn.arguments[i] ?? 0;
            // For LABEL and CONSTANT types, resolve to a literal.
            if (expected & (CON_NATIVE_FLAGS.LABEL | CON_NATIVE_FLAGS.CONSTANT)) {
              const literal = this.resolveNativeArgument(args[i] as Expression, expected, context);
              resolvedLiterals.push(literal);
              // We do not emit register loads for these.
            } else if (expected & CON_NATIVE_FLAGS.VARIABLE) {
              // For VARIABLE, generate code normally.
              code += this.visitExpression(args[i] as Expression, context);
              code += `set r${i} ra\n`;
              resolvedLiterals.push(null);
            } else {
              code += this.visitExpression(args[i] as Expression, context);
              code += `set r${i} ra\n`;
              resolvedLiterals.push(null);
            }
          }
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
          } else {
            // For complex functions, call the arrow function.
            const fnCode = nativeFn.code(undefined, "\n");
            code += fnCode + "\n";
          }
        } else {
          // If not native, assume it's a user function state.
          for (let i = 0; i < args.length; i++) {
            code += this.visitExpression(args[i] as Expression, context);
            code += `set r${i} ra\n`;
            resolvedLiterals.push(null);
          }
          code += `state ${fnNameRaw}\n`;
        }
        if (nativeFn && nativeFn.returns) {
          code += `set ra rb\n`;
        }
        return code;
      }
      
      private getTypeAliasNameForObjectLiteral(objLit: ObjectLiteralExpression): string | undefined {
        const parent = objLit.getParent();
        if (parent && parent.getKind() === SyntaxKind.VariableDeclaration) {
          const vd = parent as VariableDeclaration;
          const typeNode = vd.getTypeNode();
          if (typeNode) {
            return typeNode.getText(); // This should match one of the stored type aliases
          }
        }
        return undefined;
      }
  
      private getVarNameForObjectLiteral(objLit: ObjectLiteralExpression): string | undefined {
        const parent = objLit.getParent();
        if (parent && parent.getKind() === SyntaxKind.VariableDeclaration) {
          const vd = parent as VariableDeclaration;
          return vd.getName();
        }
        return undefined;
      }      

      private processObjectLiteral(objLit: ObjectLiteralExpression, context: TranspilerContext): { code: string, layout: { [key: string]: SymbolDefinition }, size: number } {
        let code = `/* Object literal: ${objLit.getText()} */\n`;
        
        // Reserve one slot for the object's base pointer.
        code += `add rsp 1\nset ri rsp\nadd ri 1\nsetarray stack[rsp] ri\n`;
        // The object's base pointer is now stored at stack[rsp].
        
        // Build the layout as a plain object.
        let layout: { [key: string]: SymbolDefinition } = {};
        let totalSlots = 0; // count of property slots allocated
        
        const aliasName = this.getTypeAliasNameForObjectLiteral(objLit);
        if (aliasName && context.typeAliases.has(aliasName)) {
          const typeDef = context.typeAliases.get(aliasName)!;
          // Process each expected property (in declared order from the type alias).
          for (const [propName, propType] of Object.entries(typeDef.members)) {
            totalSlots++; // Reserve one slot for this property (or the start for arrays/nested objects)
            
            // Find the property assignment in the object literal by comparing names (ignoring quotes).
            const prop = objLit.getProperties().find(p => {
              if (p.isKind(SyntaxKind.PropertyAssignment)) {
                return (p as any).getName().replace(/['"]/g, "") === propName;
              }
              return false;
            });
            
            if (prop && prop.isKind(SyntaxKind.PropertyAssignment)) {
              const pa = prop as PropertyAssignment;
              if (propType.endsWith("[]")) {
                // For an array property (e.g., low: wow[])
                const baseType = propType.slice(0, -2).trim();
                const initText = pa.getInitializerOrThrow().getText();
                const count = this.getArraySize(initText);
                const instanceSize = this.getObjectSize(baseType, context);
                // For each element, allocate instanceSize slots.
                for (let j = 0; j < count; j++) {
                  for (let k = 0; k < instanceSize; k++) {
                    code += `set ra 0\nadd rsp 1\nset stack[rsp] ra\n`;
                    totalSlots++;
                  }
                }
                layout[propName] = { 
                  name: propName, 
                  type: "array", 
                  offset: totalSlots - (count * instanceSize) + 1, 
                  size: count * instanceSize 
                };
              } else if (context.typeAliases.has(propType)) {
                // For a nested object property.
                const result = this.processObjectLiteral(pa.getInitializerOrThrow() as ObjectLiteralExpression, context);
                code += result.code;
                const nestedSize = result.size;
                layout[propName] = { 
                  name: propName, 
                  type: "object", 
                  offset: totalSlots, 
                  size: nestedSize, 
                  children: { ...result.layout }  // clone children as plain object
                };
                totalSlots += nestedSize - 1; // already counted one slot for the property
              } else {
                // For a primitive property.
                code += this.visitExpression(pa.getInitializerOrThrow(), context);
                code += `add rsp 1\nset stack[rsp] ra\n`;
                layout[propName] = { name: propName, type: "number", offset: totalSlots, size: 1 };
              }
            } else {
              // Property not provided: default to 0.
              code += `set ra 0\nadd rsp 1\nset stack[rsp] ra\n`;
              layout[propName] = { name: propName, type: "number", offset: totalSlots, size: 1 };
            }
          }
        } else {
          addDiagnostic(objLit, context, "warning", `No type alias found for object literal; assuming empty object.`);
        }
        
        // The object's base pointer is at: stack[rsp - (totalSlots + 1)]
        code += `set ri rsp\nsub ri ${totalSlots + 1}\nset ra stack[ri]\n`;
        
        // Optionally freeze the layout to avoid accidental modification.
        const frozenLayout = Object.freeze({ ...layout });
        
        return { code, layout: frozenLayout, size: totalSlots };
      }      
      

      private visitObjectLiteral(objLit: ObjectLiteralExpression, context: TranspilerContext): string {
        const result = this.processObjectLiteral(objLit, context);
        // If the object literal is assigned to a variable, retrieve its name.
        const varName = this.getVarNameForObjectLiteral(objLit);
        if (varName) {
          // Store the layout in the global symbol table.
          context.symbolTable.set(varName, { name: varName, type: "object", offset: 1, size: result.size, children: result.layout });
        }
        return result.code;
      }      
  
      private visitMemberExpression(expr: Expression, context: TranspilerContext): string {
        let code = `/* ${expr.getText()} */\n`;
        
        if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
          const pae = expr as PropertyAccessExpression;
          const objectExpr = pae.getExpression();
          const propName = pae.getName();
      
          // If object is "this"
          if (objectExpr.getText() === "this") {
            const nativeVar = findNativeVar_Sprite(propName);
            if (nativeVar) {
              if (nativeVar.var_type === CON_NATIVE_TYPE.variable) {
                code += `set ra ${nativeVar.code}\n`;
                return code;
              } else {
                code += `geta[].${nativeVar.code} ra\n`;
                return code;
              }
            } else {
              addDiagnostic(expr, context, "warning", `Property "${propName}" not found in nativeVars_Sprites`);
              code += `/* default access for ${propName} */\nset ra 0\n`;
              return code;
            }
          }
          
          // If object is the Names enum.
          if (objectExpr.getText() === "Names") {
            const enumVal = (Names as any)[propName];
            if (typeof enumVal === "number") {
              code += `set ra ${enumVal}\n`;
              return code;
            } else {
              addDiagnostic(expr, context, "error", `Unknown Names member: ${propName}`);
              code += `set ra 0\n`;
              return code;
            }
          }
          
          // If object is the sprites array.
          if (objectExpr.getText() === "sprites") {
            const nativeVar = findNativeVar_Sprite(propName);
            if (nativeVar) {
              code += `geta[THISACTOR].${nativeVar.code} ra\n`;
              return code;
            } else {
              addDiagnostic(expr, context, "warning", `Property "${propName}" not found in nativeVars_Sprites for sprites`);
              code += `set ra 0\n`;
              return code;
            }
          }
          
          // Otherwise, assume it's a user-defined object.
          // We expect the object to be an identifier whose layout was recorded in context.symbolTable.
          if (objectExpr.isKind(SyntaxKind.Identifier)) {
            const objName = objectExpr.getText();
            const sym = context.symbolTable.get(objName);
            if (sym) {
              // Load the object's base pointer from the stack.
              // Assume sym.offset stores the delta from rsp where the object pointer is stored.
              code += `set ri rsp\nsub ri ${sym.offset}\n`;
              // Load the object's pointer into rd.
              code += `set rd stack[ri]\n`;
              // Look up the requested property in the children map.
              if (sym.children && sym.children[propName]) {
                const propSym = sym.children[propName];
                // Now add the property's offset.
                code += `add rd ${propSym.offset}\n`;
                // Then load the property value from the stack.
                code += `set ra stack[rd]\n`;
                return code;
              } else {
                addDiagnostic(expr, context, "warning", `Property "${propName}" not found in symbol table for ${objName}`);
                code += `set ra 0\n`;
                return code;
              }
            }
          }
          
          // Fallback: evaluate the object and produce a placeholder.
          code += this.visitExpression(objectExpr, context);
          code += `set rd ra\n`;
          code += `/* default access for property .${propName} of custom object */\nset ra 123\n`;
          return code;
        } 
        else if (expr.isKind(SyntaxKind.ElementAccessExpression)) {
          const eae = expr as ElementAccessExpression;
          code += this.visitExpression(eae.getExpression(), context);
          code += `set rd ra\n`;
          code += this.visitExpression(eae.getArgumentExpressionOrThrow(), context);
          code += `set ri ra\n`;
          code += `/* default element access placeholder */\nset ra 777\n`;
          return code;
        }
        
        addDiagnostic(expr, context, "warning", `Unhandled member expression: ${expr.getText()}`);
        code += `set ra 0\n`;
        return code;
      }
      
      
  
    private visitUnaryExpression(expr: Expression, context: TranspilerContext): string {
      let code = `// unary: ${expr.getText()}\n`;
      if (expr.isKind(SyntaxKind.PrefixUnaryExpression)) {
        const pre = expr as PrefixUnaryExpression;
        code += this.visitExpression(pre.getOperand(), context);
        switch (pre.getOperatorToken()) {
          case SyntaxKind.PlusPlusToken:
            code += `add ra 1\n`;
            break;
          case SyntaxKind.MinusMinusToken:
            code += `sub ra 1\n`;
            break;
          case SyntaxKind.MinusToken:
            code += `neg ra\n`;
            break;
          case SyntaxKind.ExclamationToken:
            addDiagnostic(expr, context, "error", `"!" not allowed in normal expressions (only if patterns)`);
            code += `set ra 0\n`;
            break;
          default:
            addDiagnostic(expr, context, "error", `Unhandled prefix op`);
            code += `set ra 0\n`;
        }
        return code;
      } else if (expr.isKind(SyntaxKind.PostfixUnaryExpression)) {
        const post = expr as PostfixUnaryExpression;
        code += this.visitExpression(post.getOperand(), context);
        switch (post.getOperatorToken()) {
          case SyntaxKind.PlusPlusToken:
            code += `add ra 1\n`;
            break;
          case SyntaxKind.MinusMinusToken:
            code += `sub ra 1\n`;
            break;
          default:
            addDiagnostic(expr, context, "error", `Unhandled postfix op`);
            code += `set ra 0\n`;
        }
        return code;
      }
      return code;
    }
  
    private visitParenthesizedExpression(expr: ParenthesizedExpression, context: TranspilerContext): string {
      return this.visitExpression(expr.getExpression(), context);
    }
  
    /******************************************************************************
     * VISIT FUNCTION DECL
     * => state <functionName> { ... }
     ****************************************************************************/
    private visitFunctionDeclaration(fd: FunctionDeclaration, context: TranspilerContext): string {
      const name = fd.getName() || "anonFn";
      // new local context
      const localCtx: TranspilerContext = {
        ...context,
        localVarOffset: {},
        localVarCount: 0,
        paramMap: {}
      };
      let code = `state ${name} {\n`;
      fd.getParameters().forEach((p, i) => {
        localCtx.paramMap[p.getName()] = i;
      });
      const body = fd.getBody() as any;
      if (body) {
        body.getStatements().forEach(st => {
          code += indent(this.visitStatement(st, localCtx), 1) + "\n";
        });
      }
      code += `}\n`;
      return code;
    }
  
    /******************************************************************************
     * VISIT CLASS DECL => if extends CActor => parse constructor => skip code => gather actions
     ****************************************************************************/
    private visitClassDeclaration(cd: ClassDeclaration, context: TranspilerContext): string {
      const className = cd.getName() || "AnonClass";
      let code = `// class ${className}\n`;
  
      const base = cd.getExtends()?.getExpression().getText() || "";
      const isActor = base === "CActor";
      // const isEvent = base === "CEvent"; // demonstration if needed
  
      // We'll create a local context for parsing this class
      const localCtx: TranspilerContext = {
        ...context,
        localVarOffset: {},
        localVarCount: 0,
        paramMap: {},
        currentActorPicnum: undefined,
        currentActorExtra: undefined,
        currentActorIsEnemy: undefined,
        currentActorFirstAction: undefined,
        currentActorActions: [],
        currentActorMoves: [],
        currentActorAis: []
      };
  
      // visit constructor(s)
      const ctors = cd.getConstructors();
      if (ctors.length > 0) {
        code += this.visitConstructorDeclaration(ctors[0], localCtx, isActor);
      }

      // if isActor => append the actions/moves/ais lines
      if (isActor) {
        for (const a of localCtx.currentActorActions) {
          code += a + "\n";
        }
        for (const mv of localCtx.currentActorMoves) {
          code += mv + "\n";
        }
        for (const ai of localCtx.currentActorAis) {
          code += ai + "\n";
        }
      }
  
      // visit methods
      const methods = cd.getInstanceMethods();
      for (const m of methods) {
        code += this.visitMethodDeclaration(m, className, localCtx, isActor);
      }
  
      return code;
    }
  
    /******************************************************************************
     * CONSTRUCTOR => skip code, parse object literals for IAction, IMove, IAi, parse super(...) for picnum
     ****************************************************************************/
    private visitConstructorDeclaration(
      ctor: ConstructorDeclaration,
      context: TranspilerContext,
      isActor: boolean
    ): string {
      let code = `// skipping actual constructor code\n`;
      const body = ctor.getBody() as any;
      if (body && isActor) {
        const statements = body.getStatements();
        for (const st of statements) {
          // e.g. variable statements => might define IAction, IMove, IAi
          // expression => maybe super(...)
          if (st.isKind(SyntaxKind.VariableStatement)) {
            const vs = st as VariableStatement;
            const decls = vs.getDeclarationList().getDeclarations();
            decls.forEach(d => this.parseVarForActionsMovesAi(d, context));
          } else if (st.isKind(SyntaxKind.ExpressionStatement)) {
            const es = st as ExpressionStatement;
            const expr = es.getExpression();
            if (expr.isKind(SyntaxKind.CallExpression)) {
              const call = expr as CallExpression;
              if (call.getExpression().getText() === "super") {
                this.parseActorSuperCall(call, context);
              }
            }
          }
        }
      }
      return code;
    }
  
    private parseVarForActionsMovesAi(decl: VariableDeclaration, context: TranspilerContext) {
      // check type => if IAction, IMove, IAi => parse
      const typeNode = decl.getTypeNode();
      if (!typeNode) return;
      const typeStr = typeNode.getText();
      if (typeStr === "IAction") {
        this.parseIAction(decl, context);
      } else if (typeStr === "IMove") {
        this.parseIMove(decl, context);
      } else if (typeStr === "IAi") {
        this.parseIAi(decl, context);
      }
    }
  
    private parseIAction(decl: VariableDeclaration, context: TranspilerContext) {
      const init = decl.getInitializer();
      if (!init || !init.isKind(SyntaxKind.ObjectLiteralExpression)) return;
      const obj = init as ObjectLiteralExpression;
      let actionName = "", start = 0, length = 0, viewType = 0, incValue = 0, delay = 0;
      obj.getProperties().forEach(p => {
        if (p.isKind(SyntaxKind.PropertyAssignment)) {
          const key = p.getName();
          const val = p.getInitializerOrThrow();
          switch (key) {
            case "name":        actionName = val.getText().replace(/['"]/g, ""); break;
            case "start":       start = parseInt(val.getText(), 10); break;
            case "length":      length = parseInt(val.getText(), 10); break;
            case "viewType":    viewType = parseInt(val.getText(), 10); break;
            case "incValue":    incValue = parseInt(val.getText(), 10); break;
            case "delay":       delay = parseInt(val.getText(), 10); break;
          }
        }
      });
      context.currentActorActions.push(`action ${actionName} ${start} ${length} ${viewType} ${incValue} ${delay}`);
    }
  
    private parseIMove(decl: VariableDeclaration, context: TranspilerContext) {
      const init = decl.getInitializer();
      if (!init || !init.isKind(SyntaxKind.ObjectLiteralExpression)) return;
      const obj = init as ObjectLiteralExpression;
      let moveName = "", hv = 0, vv = 0;
      obj.getProperties().forEach(p => {
        if (p.isKind(SyntaxKind.PropertyAssignment)) {
          const key = p.getName();
          const val = p.getInitializerOrThrow();
          switch (key) {
            case "name": moveName = val.getText().replace(/['"]/g, ""); break;
            case "horizontal_vel": hv = parseInt(val.getText(), 10); break;
            case "vertical_vel": vv = parseInt(val.getText(), 10); break;
          }
        }
      });
      context.currentActorMoves.push(`move ${moveName} ${hv} ${vv}`);
    }

    private parseIAi(decl: VariableDeclaration, context: TranspilerContext) {
      const init = decl.getInitializer();
      if (!init || !init.isKind(SyntaxKind.ObjectLiteralExpression)) return;
      const obj = init as ObjectLiteralExpression;
      let aiName = "", actionLabel = "", moveLabel = ""; 
      let flags = 0;
      obj.getProperties().forEach(p => {
        if (p.isKind(SyntaxKind.PropertyAssignment)) {
          const key = p.getName();
          const val = p.getInitializerOrThrow();
          switch (key) {
            case "name": aiName = val.getText().replace(/['"]/g, ""); break;
            case "action": actionLabel = val.getText().replace(/['"]/g, ""); break;
            case "move": moveLabel = val.getText().replace(/['"]/g, ""); break;
            case "flags": flags = evalMoveFlags(val, context); break;
          }
        }
      });
      context.currentActorAis.push(`ai ${aiName} ${actionLabel} ${moveLabel} ${flags}`);
    }
  
    private parseActorSuperCall(call: CallExpression, context: TranspilerContext) {
      // super(picnum, isEnemy, extra, actions, firstAction, moves, ais)
      const args = call.getArguments();
      if (args.length >= 1) {
        const a0 = args[0];
        if (a0.isKind(SyntaxKind.NumericLiteral)) {
          context.currentActorPicnum = parseInt(a0.getText(), 10);
        }
      }
      if (args.length >= 2) {
        const a1 = args[1];
        if (a1.isKind(SyntaxKind.TrueKeyword)) {
          context.currentActorIsEnemy = true;
        } else if (a1.isKind(SyntaxKind.FalseKeyword)) {
          context.currentActorIsEnemy = false;
        }
      }
      if (args.length >= 3) {
        const a2 = args[2];
        if (a2.isKind(SyntaxKind.NumericLiteral)) {
          context.currentActorExtra = parseInt(a2.getText(), 10);
        }
      }
      if (args.length >= 5) {
        // first_action
        const fa = args[4];
        context.currentActorFirstAction = fa.getText().replace(/['"]/g, "");
      }
    }
  
    /******************************************************************************
     * visitMethodDeclaration => if main() => useractor ...
     ****************************************************************************/
    private visitMethodDeclaration(
      md: MethodDeclaration,
      className: string,
      context: TranspilerContext,
      isActor: boolean
    ): string {
      const mName = md.getName();
      const localCtx: TranspilerContext = {
        ...context,
        localVarOffset: {},
        localVarCount: 0,
        paramMap: {}
      };
  
      if (isActor && mName === "Main") {
        const pic = localCtx.currentActorPicnum || 0;
        const extra = localCtx.currentActorExtra || 0;
        const firstAction = localCtx.currentActorFirstAction || "0";
        let code = `useractor 0 ${pic} ${extra} ${firstAction} \n`;
        md.getParameters().forEach((p, i) => {
          localCtx.paramMap[p.getName()] = i;
        });
        const body = md.getBody() as any;
        if (body) {
          body.getStatements().forEach(st => {
            code += indent(this.visitStatement(st, localCtx), 1) + "\n";
          });
        }
        code += `set rbp 0 \nset rsp -1 \nenda \n`;
        return code;
      }
  
      // otherwise => normal state
      let code = `defstate ${className}_${mName} \nset ra rbp \nstate push \nset rbp rsp \n`;
      md.getParameters().forEach((p, i) => {
        localCtx.paramMap[p.getName()] = i;
      });
      const body = md.getBody() as any;
      if (body) {
        body.getStatements().forEach(st => {
          code += indent(this.visitStatement(st, localCtx), 1) + "\n";
        });
      }
      code += `set rsp rbp \nstate pop \nset rbp ra \nends \n`;
      return code;
    }
  }
  