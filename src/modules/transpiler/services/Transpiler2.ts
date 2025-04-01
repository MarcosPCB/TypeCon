import fs from 'fs';
import path from 'path';

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
  PropertyAssignment,
  SwitchStatement,
  NumericLiteral,
  ObjectLiteralElementLike,
  ImportDeclaration,
  ModuleDeclaration,
  InterfaceDeclaration,
  EnumDeclaration,
  EnumMember,
  StringLiteral,
  Identifier
} from "ts-morph";

import {
  CON_NATIVE_FLAGS,
  nativeFunctions,
  EMoveFlags,
  CON_NATIVE_FUNCTION,
  CON_NATIVE_TYPE,
  nativeVars_Sprites,
  CON_NATIVE_VAR,
  nativeVars_Sectors,
  nativeVars_Walls,
  nativeVarsList
} from '../../../sets/TCSet100/native';

import { EventList, Names, TEvents } from "../types";

import { evalMoveFlags, findNativeFunction, findNativeVar_Sprite } from "../helper/helpers";
import { compiledFiles, ECompileOptions, ICompiledFile } from "../helper/translation";


type DiagnosticSeverity = "error" | "warning";

type IfCondition =
  | { op: "ifand" | "ifeither" | "ifneither" | "ife" | "ifn" | "ifl" | "ifg" | "ifle" | "ifge"; left: Expression; right: Expression | number };


interface SegmentIdentifier {
  kind: "identifier" | "this";
  name: string; // e.g. "foo" or "this"
}

interface SegmentProperty {
  kind: "property";
  name: string; // e.g. "bar"
}

interface SegmentIndex {
  kind: "index";
  expr: Expression; // the expression inside [...], e.g. "baz"
}

type MemberSegment = SegmentIdentifier | SegmentProperty | SegmentIndex;

interface TranspileDiagnostic {
  line: number;
  message: string;
  severity: DiagnosticSeverity;
}

interface TranspilerOptions {
  debug?: boolean;
  lineDetail?: boolean;
}

interface SymbolDefinition {
  name: string;
  type: "number" | "string" | "object" | "array" | "pointer" | 'function' | 'native' | 'quote';
  offset: number;        // Delta from the object's base pointer.
  size?: number;         // How many slots this symbol occupies.
  num_elements?: number;
  heap?: boolean,
  native_pointer?: 'sprites' | 'sectors' | 'walls' | 'players' | 'projectiles',
  //This is only used IF we do something like 'const s = sprites[2]', 
  //otherwise, the compiler treats like a pointer to the complete array structure: 'const s = sprites'
  native_pointer_index?: boolean,
  children?: { [key: string]: SymbolDefinition }; // For nested objects.
  CON_code?: string,
}

interface TypeAliasDefinition {
  name: string;
  members: Record<string, string>; // property name -> type (as a string)
  literal?: string;
}

interface EnumDefinition {
  name: string,
  members: Record<string, number>
}

/** 
 * The transpiler context, storing local var offsets, param maps, 
 * plus info about CActor if we are in one, etc.
 */
export interface TranspilerContext {
  localVarOffset: Record<string, number>;
  localVarCount: number;
  localVarNativePointer: 'sprites' | 'sectors' | 'walls' | 'players' | 'projectiles' | undefined, //Only true if you're passing a native pointer to a local variable
  localVarNativePointerIndexed: boolean,
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

  enums: Map<string, EnumDefinition>;

  // New symbol table for object layouts (global or per–scope)
  symbolTable: Map<string, SymbolDefinition>;

  currentFile: ICompiledFile;

  stringExpr: boolean;
  quoteExpr: boolean;
}

interface TranspileResult {
  conOutput: string;
  diagnostics: TranspileDiagnostic[];
}

function resolveImport(baseFile: string, importPath: string): string | null {
  // 1) If it's a relative/absolute import, do your existing logic
  if (
    importPath.startsWith("./") ||
    importPath.startsWith("../") ||
    importPath.startsWith("/")
  ) {
    // e.g. baseFile = "/path/to/currentFile.ts"
    // get directory
    const dir = path.dirname(baseFile);
    let fullPath = path.resolve(dir, importPath);

    // If no extension, try ".ts"
    if (!path.extname(fullPath)) {
      fullPath += ".ts";
    }
    return fullPath;
  }

  // 2) Otherwise, try Node's module resolution for "some-package"
  try {
    return require.resolve(importPath, {
      paths: [path.dirname(baseFile)]
    });
  } catch (err) {
    console.error(`Could not resolve '${importPath}' from '${baseFile}'`);
    return null;
  }
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
 * MAIN COMPILER CLASS
 *****************************************************************************/
export class TsToConTranspiler {
  private project: Project;
  private options: TranspilerOptions;

  constructor(options: TranspilerOptions = {}) {
    this.options = options;
    this.project = new Project({ useInMemoryFileSystem: true });
  }

  public transpile(sourceCode: string, file: string, prvContext?: TranspilerContext): TranspileResult {
    const sf = this.project.createSourceFile(`temp_${Buffer.from(file).toString('base64url')}.ts`, sourceCode, {
      overwrite: true
    });

    const context: TranspilerContext = prvContext ? prvContext : {
      localVarOffset: {},
      localVarCount: 0,
      localVarNativePointer: undefined,
      localVarNativePointerIndexed: false,
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
      enums: new Map(),
      symbolTable: new Map(),
      currentFile: undefined,
      stringExpr: false,
      quoteExpr: false
    };

    const outputLines: string[] = [];

    if (compiledFiles.get(Buffer.from(file).toString('base64url')))
      return null;

    compiledFiles.set(Buffer.from(file).toString('base64url'), {
      path: file,
      code: '',
      declaration: false,
      context,
      options: ECompileOptions.none
    })

    context.currentFile = compiledFiles.get(Buffer.from(file).toString('base64url'));

    const imports = sf.getImportDeclarations();

    if (imports.length > 0) {
      for (const i of imports) {
        const fName = i.getModuleSpecifierValue();

        const cFile = path.basename(file);

        const resolved = resolveImport(file, fName);
        if (!resolved) {
          console.log(`\nUnable to include file: ${fName}`);
          continue;
        }

        if (compiledFiles.has(Buffer.from(resolved).toString('base64url')))
          continue;

        try {
          //context.currentFile.dependency.push(Buffer.from(resolved).toString('base64url'));
          const prvFile = context.currentFile;
          const sCode = fs.readFileSync(resolved);
          this.transpile(sCode.toString(), resolved, context);
          context.currentFile = prvFile;
          context.diagnostics.length = 0;
        } catch (err) {
          console.log(`\nCannot open include file: ${resolved}`);
          console.log(err);
        }
      }
    }

    if (prvContext)
      console.log(`Including ${file}...`);

    const modules = sf.getModules();

    if (modules.length > 0) {
      if (modules.findIndex(e => e.getName() == 'noread') != -1) {
        context.currentFile.options = ECompileOptions.no_read;
        console.log(`Ignoring...\n`);
        return null;
      } else { 
        if (modules.findIndex(e => e.getName() == 'nocompile') != -1) {
          console.log(`Building symbols only...`);
          context.currentFile.options |= ECompileOptions.no_compile;
        } 
        
        if(modules.findIndex(e => e.getName() == 'statedecl') != -1) {
          console.log(`Reading functions as states...`);
          context.currentFile.options |= ECompileOptions.state_decl;
        }
      }
    } else console.log(`Compiling ${file}...`);

    sf.getStatements().forEach(st => {
      if (st.isKind(SyntaxKind.FunctionDeclaration)) {
        outputLines.push(this.visitFunctionDeclaration(st as FunctionDeclaration, context));
      } else if (st.isKind(SyntaxKind.ClassDeclaration) && !(context.currentFile.options & ECompileOptions.no_compile)) {
        outputLines.push(this.visitClassDeclaration(st as ClassDeclaration, context));
      } else {
        outputLines.push(this.visitStatement(st, context));
      }
    });

    if (modules.length > 0) {
      if (modules.findIndex(e => e.getName() == 'nocompile') != -1)
        outputLines.length = 0;
      else context.currentFile.code = outputLines.join('\n');
    } else context.currentFile.code = outputLines.join('\n');

    if (context.diagnostics.length > 0) {
      console.log("\n=== DIAGNOSTICS ===");
      for (const diag of context.diagnostics) {
        console.log(`[${diag.severity}] line ${diag.line}: ${diag.message}`);
      }
      console.log('\n');
    } else {
      console.log("No errors or warnings.\n");
    }

    return {
      conOutput: outputLines.join("\n"),
      diagnostics: context.diagnostics
    };
  }

  private storeTypeAlias(ta: TypeAliasDeclaration, context: TranspilerContext): void {
    const aliasName = ta.getName();
    const typeNode = ta.getTypeNode();

    if (!typeNode || !typeNode.isKind(SyntaxKind.TypeLiteral)) {
      if (typeNode) {
        if (['OnEvent', 'constant', 'TLabel', 'CON_NATIVE', 'CON_NATIVE_POINTER'].includes(aliasName))
          return;

        if (typeNode.getKind() == SyntaxKind.NumberKeyword
          || typeNode.getKind() == SyntaxKind.StringKeyword
          || typeNode.getKind() == SyntaxKind.StringLiteral
          || typeNode.getKind() == SyntaxKind.UnionType)
          return;
      }
      addDiagnostic(ta, context, "warning", `Type alias ${aliasName} is not a literal type.`);
      return;
    }

    if (typeNode.isKind(SyntaxKind.TypeLiteral)) {
      const typeLiteral = typeNode as TypeLiteralNode;
      const members: Record<string, string> = {};
      typeLiteral.getMembers().forEach((member, i) => {
        if (member.getKind() === SyntaxKind.PropertySignature) {
          const prop = member as PropertySignature;
          members[prop.getName()] = prop.getType().getText();
        }
      });
      context.typeAliases.set(aliasName, { name: aliasName, members });
    }

    if (typeNode.isKind(SyntaxKind.NumberKeyword))
      context.typeAliases.set(aliasName, { name: aliasName, literal: 'number', members: {} });

    if (typeNode.isKind(SyntaxKind.StringKeyword | SyntaxKind.UnionType))
      context.typeAliases.set(aliasName, { name: aliasName, literal: 'string', members: {} });
  }

  private storeInterface(id: InterfaceDeclaration, context: TranspilerContext): void {
    const aliasName = id.getName();

    const members: Record<string, string> = {};
    id.getMembers().forEach((member, i) => {
      if (member.getKind() === SyntaxKind.PropertySignature) {
        const prop = member as PropertySignature;
        members[prop.getName()] = prop.getType().getText();
      }
    });
    context.typeAliases.set(aliasName, { name: aliasName, members });
  }

  private storeEnum(ed: EnumDeclaration, context: TranspilerContext): void {
    const name = ed.getName();

    const members: Record<string, number> = {};
    ed.getMembers().forEach((member, i) => {
      if (member.getKind() === SyntaxKind.EnumMember) {
        const prop = member as EnumMember;
        members[prop.getName()] = prop.getValue() as number;
      }
    });
    context.enums.set(name, { name: name, members });
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

  private getObjectTypeLayout(typeName: string, context: TranspilerContext): { [key: string]: SymbolDefinition } {
    if (context.typeAliases.has(typeName)) {
      const typeDef = context.typeAliases.get(typeName)!;
      let layout: { [key: string]: SymbolDefinition } = {};
      const keys = Object.keys(typeDef.members);
      for (let i = 0; i < keys.length; i++) {
        const t = typeDef.members[keys[i]];
        const k = keys[i];
        // If the member is an array type (e.g., "wow[]")
        if (t.endsWith("[]")) {
          // Strip the brackets to get the base type.
          const baseType = t.slice(0, -2).trim();
          // Recursively compute the layout for one element of the array.
          if (context.typeAliases.has(baseType)) {
            layout = { ...this.getObjectTypeLayout(baseType, context) };
          } else {
            // For primitive arrays, assume one slot per element.
            layout[k] = {
              name: k,
              //@ts-ignore
              type: baseType,
              offset: i,
              size: 1
            };
          }
        } else {
          // Otherwise, assume a primitive type takes one slot.
          layout[k] = {
            name: k,
            //@ts-ignore
            type: t,
            offset: i,
            size: 1
          };
        }
      }

      return layout;
    }
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
    let code = ''//`/* ${stmt.getText()} */\n`;
    switch (stmt.getKind()) {
      case SyntaxKind.VariableStatement:
        if (context.currentFile.options & ECompileOptions.no_compile)
          return code;

        return code + this.visitVariableStatement(stmt as VariableStatement, context);

      case SyntaxKind.ExpressionStatement:
        if (context.currentFile.options & ECompileOptions.no_compile)
          return code;

        return code + this.visitExpressionStatement(stmt as ExpressionStatement, context);

      case SyntaxKind.ReturnStatement:
        if (context.currentFile.options & ECompileOptions.no_compile)
          return code;

        return code + this.visitReturnStatement(stmt as ReturnStatement, context);

      case SyntaxKind.IfStatement:
        if (context.currentFile.options & ECompileOptions.no_compile)
          return code;

        return code + this.visitIfStatement(stmt as IfStatement, context);

      case SyntaxKind.SwitchStatement:
        if (context.currentFile.options & ECompileOptions.no_compile)
          return code;

        return code + this.visitSwitchStatement(stmt as SwitchStatement, context);

      case SyntaxKind.TypeAliasDeclaration:
        this.storeTypeAlias(stmt as TypeAliasDeclaration, context);
        break;

      case SyntaxKind.InterfaceDeclaration:
        this.storeInterface(stmt as InterfaceDeclaration, context);
        break;

      case SyntaxKind.EnumDeclaration:
        this.storeEnum(stmt as EnumDeclaration, context);
        break;

      case SyntaxKind.BreakStatement:
        return code + `break\n`;

      case SyntaxKind.ModuleDeclaration:
        const b = context.currentFile.options;
        context.currentFile.options |= ECompileOptions.no_compile;
        const stmts = (stmt as ModuleDeclaration).getStatements();

        stmts.forEach(st => {
          if (!st.isKind(SyntaxKind.ClassDeclaration))
            this.visitStatement(st, context);
        });
        context.currentFile.options = b;
        return code;

      case SyntaxKind.ImportDeclaration:
        return code;

      case SyntaxKind.FunctionDeclaration:
        return code + this.visitFunctionDeclaration(stmt as FunctionDeclaration, context);

      default:
        addDiagnostic(stmt, context, "warning", `Unhandled statement kind: ${stmt.getKindName()}`);
        return code;
    }
  }

  /******************************************************************************
   * variable statements => local var
   *****************************************************************************/
  private visitVariableStatement(node: VariableStatement, context: TranspilerContext): string {
    let code = this.options.lineDetail ? `/*${node.getText()}*/\n` : '';
    const decls = node.getDeclarationList().getDeclarations();
    for (const d of decls) {
      code += this.visitVariableDeclaration(d, context);
    }
    return code;
  }

  private visitVariableDeclaration(decl: VariableDeclaration, context: TranspilerContext): string {
    const varName = decl.getName();
    let code = "";

    const type = decl.getType();

    if(type && type.getAliasSymbol() && type.getAliasSymbol().getName() == 'CON_NATIVE_GAMEVAR') {
      context.symbolTable.set(varName, {
        name: varName, type: "native", offset: 0, size: 1, CON_code: type.getAliasTypeArguments()[0].getText().replace(/[`'"]/g, "")
      });
      return code;
    } 

    const init = decl.getInitializer();
    if (init && init.isKind(SyntaxKind.ObjectLiteralExpression)) {
      code += this.visitObjectLiteral(init as ObjectLiteralExpression, context);
      context.localVarCount++;
      // Store in symbol table that varName is an object.
      //const aliasName = this.getTypeAliasNameForObjectLiteral(init as ObjectLiteralExpression);
      //const size = aliasName ? this.getObjectSize(aliasName, context) : 0;

      //context.symbolTable.set(varName, { name: varName, type: "object", offset: 0, size: size });
    } else {
      // Process non-object initializers as before.
      const localVars = context.localVarCount;
      code += this.visitExpression(init as Expression, context);
      if(!context.stringExpr)
        code += `add rsp 1\nsetarray flat[rsp] ra\n`;
      context.symbolTable.set(varName, {
        name: varName, type: context.stringExpr ? 'string' : "number",
        offset: localVars, size: 1,
        native_pointer: context.localVarNativePointer,
        native_pointer_index: context.localVarNativePointerIndexed
      });
      context.localVarNativePointer = undefined;
      context.localVarNativePointerIndexed = false;
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
    let code = this.options.lineDetail ? `/*${is.getText()}*/\n` : '';
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
    code += indent(thenPart, 1);
    if (elsePart != '') {
      code += `} else {\n`;
      code += indent(elsePart, 1);
    }

    code += `}\n`;

    return code;
  }

  private visitSwitchStatement(sw: SwitchStatement, context: TranspilerContext) {
    let code = (this.options.lineDetail ? `/*${sw.getText()}*/\n` : '') + this.visitExpression(sw.getExpression(), context);
    const cases = sw.getCaseBlock().getClauses();
    code += `switch ra\n`;
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      if (c.isKind(SyntaxKind.DefaultClause))
        code += `default:\n`;
      else {
        const clause = c.getExpression();
        if (clause.isKind(SyntaxKind.CallExpression) && clause.getExpression().getText() == 'Label') {
          const innerArgs = (clause as CallExpression).getArguments();
          if (innerArgs.length > 0) {
            code += `case ${innerArgs[0].getText().replace(/[`'"]/g, "")}:\n`;
          } else {
            addDiagnostic(clause, context, "error", "Label() called without an argument");
            return code;
          }
        } else if (clause.isKind(SyntaxKind.NumericLiteral))
          code += `case ${(clause as NumericLiteral).getText()}:\n`
        else {
          addDiagnostic(clause, context, "error", `Invalid case clause: ${clause.getText()}`);
          return code;
        }
      }

      c.getStatements().forEach(e => code += this.visitStatement(e, context));
    }
    code += `endswitch\n`;

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
      /*const callExp = call.getExpression();
      let fnNameRaw = '';
      let fnObj: string | undefined;
      if (callExp.isKind(SyntaxKind.Identifier))
        fnNameRaw = call.getExpression().getText();
      else if (callExp.isKind(SyntaxKind.PropertyAccessExpression)
        || callExp.isKind(SyntaxKind.ElementAccessExpression)) {
        const segments = this.unrollMemberExpression(callExp);

      let obj = segments[0];*/
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
    let code = ''//`/* ${expr.getText()} */\n`;
    context.stringExpr = context.quoteExpr = false;

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

    context.stringExpr = false;
    context.quoteExpr = false;

    if (expr.isKind(SyntaxKind.Identifier)) {
      const name = expr.getText();
      // check param
      if (name in context.paramMap) {
        const i = context.paramMap[name];
        code += `set ra r${i}\n`;
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
        const off = context.symbolTable.get(name)
        if(off.type == 'native')
          return code + `set ra ${off.CON_code}\n`;

        code += `set ri rbp\nadd ri ${off.offset}\nset ra flat[ri]\n`;
        if(off.type == 'string')
          context.stringExpr = true;
        if (off.heap)
          code += `set rf 1\n`;
        return code;
      }
      // fallback => unknown
      addDiagnostic(expr, context, "error", `Unknown identifier: ${name}`);
      code += `set ra 0\n`;
      return code;
    }

    if (expr.isKind(SyntaxKind.NumericLiteral)) {
      code += `set ra ${expr.getText()}\n`;
      return code;
    }
    if (expr.isKind(SyntaxKind.StringLiteral)) {
      let text = expr.getText().replace(/[`'"]/g, "");
      code += `state pushr1\nset r0 ${text.length + 1}\nstate alloc\nstate popr1\nadd rsp 1\nsetarray flat[rsp] rb\nsetarray flat[rb] ${text.length}\nset ri rb\n`;
      //code += `add rsp 1\nset rd rsp\nadd rsp 1\nsetarray flat[rsp] ${text.length}\n`;
      for(let i = 0; i < text.length; i++)
        code += `add ri 1\nsetarray flat[ri] ${text.charCodeAt(i)}\n`;

      code += `set ra rb\n`;
      context.stringExpr = true;
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

    let code = this.options.lineDetail ? `// binary: ${left.getText()} ${opText} ${right.getText()}\n` : '';

    /*const forbidden = ["<", ">", "<=", ">=", "==", "!=", "&&", "||"];
    if (forbidden.includes(opText)) {
      addDiagnostic(bin, context, "error", `Operator "${opText}" not allowed in normal expressions`);
      code += `set ra 0\n`;
      return code;
    }*/

    if (opText === "=") {
      // assignment
      code += this.visitExpression(right, context);
      code += this.storeLeftSideOfAssignment(left, context);
      return code;
    }

    code += this.visitExpression(left, context);
    const isQuote = context.quoteExpr;
    const isString = context.stringExpr;

    if(isQuote && opText != '+') {
      addDiagnostic(bin, context, "error", `Unhandled operator for string expression "${opText}"`);
        code += `set ra 0\n`;
    }

    code += `set rd ra\n`;
    code += this.visitExpression(right, context);

    if(isQuote && !context.quoteExpr)
      code += `qputs 1022 %d\nqsprintf 1023 1022 ra\nset ra 1022\n`;

    if(isString && !context.stringExpr)
      code += `state pushr1\nset r0 ra\nstate _convertInt2String\nset ra rb\n`

    context.quoteExpr = isQuote;
    context.stringExpr = isString;

    switch (opText) {
      case "+":
        if(isQuote)
          code += `qstrcat rd ra\n`;
        else if(isString)
          code += `state pushr2\nset r0 rd\nset r1 ra\nstate _stringConcat\nset ra rb\n`;
        else
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
      case "&":
        code += `and rd ra\nset ra rd\n`;
        break;
      case "|":
        code += `or rd ra\nset ra rd\n`;
        break;
      case "^":
        code += `xor rd ra\nset ra rd\n`;
        break;
      case ">>":
        code += `shiftr rd ra\nset ra rd\n`;
        break;
      case "<<":
        code += `shiftl rd ra\nset ra rd\n`;
        break;
      case "<":
        code += `set rb 0\nifl rd ra\n  set rb 1\nset ra rb\n`;
        break;
      case "<=":
        code += `set rb 0\nifle rd ra\n  set rb 1\nset ra rb\n`;
        break;
      case ">":
        code += `set rb 0\nifg rd ra\n  set rb 1\nset ra rb\n`;
        break;
      case ">=":
        code += `set rb 0\nifge rd ra\n  set rb 1\nset ra rb\n`;
        break;
      case "==":
        code += `set rb 0\nife rd ra\n  set rb 1\nset ra rb\n`;
        break;
      case "!=":
        code += `set rb 0\nifn rd ra\n  set rb 1\nset ra rb\n`;
        break;
      case "&&":
        code += `set rb 0\nifand rd ra\n  set rb 1\nset ra rb\n`;
        break;
      case "||":
        code += `set rb 0\nifeither rd ra\n  set rb 1\nset ra rb\n`;
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
        code += `set ri rbp\nsub ri ${off}\nsetarray flat[ri] ra\n`;
        return code;
      }

      const v = context.symbolTable.get(name);

      if (v) {
        if(v.type == 'native')
          return code + `set ${v.CON_code} ra\n`;

        if(v.type == 'quote')
          return code + `set ri rsbp\nadd ri ${v.offset}\nqstrcpy ri ra\n`;

        code += `set ri rbp\nadd ri ${v.offset}\nsetarray flat[ri] ra\n`;
        return code;
      }

      addDiagnostic(left, context, "error", `Assignment to unknown identifier: ${name}`);
      code += `set ra 0\n`;
      return code;
    }

    if (left.isKind(SyntaxKind.PropertyAccessExpression) || left.isKind(SyntaxKind.ElementAccessExpression)) {
      code += `state push\n`;
      code += this.visitMemberExpression(left, context, true);
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
          return innerArgs[0].getText().replace(/[`'"]/g, "");
        } else {
          addDiagnostic(arg, context, "error", "Label() called without an argument");
          return "";
        }
      }
      // If it's a string literal, return its unquoted text.
      if (arg.isKind(SyntaxKind.StringLiteral)) {
        return arg.getText().replace(/[`'"]/g, "");
      }
      addDiagnostic(arg, context, "error", "Expected a label literal for a native LABEL argument");
      return "";
    }
    // If expected type is CONSTANT:
    if (expected & CON_NATIVE_FLAGS.CONSTANT) {
      if (arg.isKind(SyntaxKind.NumericLiteral)) {
        return arg.getText();
      }

      if (arg.isKind(SyntaxKind.PropertyAccessExpression) || arg.isKind(SyntaxKind.ElementAccessExpression))
        return this.visitMemberExpression(arg, context, false, true);

      if (arg.isKind(SyntaxKind.CallExpression) && arg.getExpression().getText() === "Label") {
        const innerArgs = (arg as CallExpression).getArguments();
        if (innerArgs.length > 0) {
          return innerArgs[0].getText().replace(/[`'"]/g, "");
        } else {
          addDiagnostic(arg, context, "error", "Label() called without an argument");
          return "";
        }
      }

      addDiagnostic(arg, context, "error", "Expected a numeric constant for a native CONSTANT argument");
      return "";
    }
    // For VARIABLE arguments, we assume that the value is loaded into a register already.
    return "";
  }


  private visitCallExpression(call: CallExpression, context: TranspilerContext): string {
    let code = this.options.lineDetail ? `/* ${call.getText()} */\n` : '';
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
      const segments = this.unrollMemberExpression(callExp);

      let obj = segments[0];

      if (obj.kind == 'this') {
        if (segments.length == 2 && segments[1].kind != 'index')
          fnNameRaw = segments[1].name;
        else {
          //Assume it's greater than 2
          //In this case, we know this is not a native function
          //Search in the context for any objects/classes that contain the function

          obj = segments[1] as SegmentProperty;

          let o = context.symbolTable.get(obj.name);

          if (!o || !o.children) {
            addDiagnostic(call, context, 'error', `Invalid object ${obj.name}: ${fnNameRaw}`);
            return '';
          }

          for (let i = 2; i < segments.length; i++) {
            if (segments[i].kind == 'index') {
              if (o.type != 'array') {
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

            o = o.children[obj.name];
            if (i != segments.length - 1) {
              if (o.type == 'function') {
                //Function properties are not yet supported
                addDiagnostic(call, context, 'error', `Function properties are not yet supported: ${fnNameRaw}`);
                return '';
              }

              if (o.type != 'object' && o.type != 'array') {
                addDiagnostic(call, context, 'error', `Invalid object ${obj.name}: ${fnNameRaw}`);
                return '';
              }

              continue;
            }

            //If got it here, than we found the function
            //If not native, assume it's a user function state.
            //TO-DO: SETUP THE STACK WITH THE HEAP ELEMENTS OF THE INSTANTIATED CLASS
            if (args.length > 0) {
              code += `state pushr${args.length > 12 ? 'all' : args.length}\n`;
              context.localVarCount += args.length;
            }
            for (let i = 0; i < args.length; i++) {
              code += this.visitExpression(args[i] as Expression, context);
              code += `set r${i} ra\n`;
              resolvedLiterals.push(null);
            }

            code += `state ${o.name}\nset ra rb\n`;
            if (args.length > 0) {
              code += `state popr${args.length > 12 ? 'all' : args.length}\n`;
              context.localVarCount -= args.length;
            }
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

          for (let i = 1; i < segments.length; i++) {
            if (segments[i].kind == 'index') {
              if (o.type != 'array') {
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

            o = o.children[obj.name];
            if (i != segments.length - 1) {
              if (o.type == 'function') {
                //Function properties are not yet supported
                addDiagnostic(call, context, 'error', `Function properties are not yet supported: ${fnNameRaw}`);
                return '';
              }

              if (o.type != 'object' && o.type != 'array') {
                addDiagnostic(call, context, 'error', `Invalid object ${obj.name}: ${fnNameRaw}`);
                return '';
              }

              continue;
            }

            //If got it here, than we found the function
            //If not native, assume it's a user function state.
            //TO-DO: SETUP THE STACK WITH THE HEAP ELEMENTS OF THE INSTANTIATED CLASS
            if (args.length > 0) {
              code += `state pushr${args.length > 12 ? 'all' : args.length}\n`;
              context.localVarCount += args.length;
            }
            for (let i = 0; i < args.length; i++) {
              code += this.visitExpression(args[i] as Expression, context);
              code += `set r${i} ra\n`;
              resolvedLiterals.push(null);
            }

            code += `state ${o.name}\nset ra rb\n`;
            if (args.length > 0) {
              code += `state popr${args.length > 12 ? 'all' : args.length}\n`;
              context.localVarCount -= args.length;
            }
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

    if(fnNameRaw == 'Quote' && !fnObj) {
      if(args[0].isKind(SyntaxKind.StringLiteral)) {
        let text = args[0].getText().replace(/[`'"]/g, "");
        if(text.length > 128) {
          addDiagnostic(args[0], context, 'warning', `Quote length greater than 128, truncating...`);
          text = text.slice(0, 128);
        }
        code += `add rssp 1\nqputs 1023 ${text}\nqstrcpy rssp 1023\nset ra rssp\n`;
        return code;
      } else {
        code += this.visitExpression(args[0] as Expression, context);
        code += `state pushr1\nset r0 ra\nstate _convertString2Quote\nstate popr1\nset ra rb\n`
        return code;
      }
    }

    const variable = context.symbolTable.get(fnObj);
    let typeName: undefined | string = undefined;

    if(variable && (variable.type != 'function' && variable.type != 'array' && variable.type != 'object'))
      typeName = variable.type;

    const nativeFn = findNativeFunction(fnNameRaw, fnObj, typeName);
    if (nativeFn) {
      let argCode = '';
      let argsLen = 0;

      if(nativeFn.type_belong)
        argsLen++;

      if (args.length > 0) {
        nativeFn.arguments.forEach(e => {
          argsLen++;
          if (e == CON_NATIVE_FLAGS.OBJECT || e == CON_NATIVE_FLAGS.ARRAY)
            argsLen++;
        });
        code += `state pushr${argsLen > 12 ? 'all' : argsLen}\n`;
        context.localVarCount += argsLen;
      }
      for (let i = 0, j = 0; i < args.length; i++, j++) {
        const expected = nativeFn.arguments[i] ?? 0;
        // For LABEL and CONSTANT types, resolve to a literal.
        if (expected & (CON_NATIVE_FLAGS.LABEL | CON_NATIVE_FLAGS.CONSTANT)) {
          const literal = this.resolveNativeArgument(args[i] as Expression, expected, context);
          resolvedLiterals.push(literal);
          // We do not emit register loads for these.
        } else if (expected & CON_NATIVE_FLAGS.STRING) {
          code += this.visitExpression(args[i] as Expression, context);
          code += `set r${j} ra\n`;
          resolvedLiterals.push(null);
        } else if (expected & CON_NATIVE_FLAGS.VARIABLE) {
          // For VARIABLE, generate code normally.
          code += this.visitExpression(args[i] as Expression, context);
          code += `set r${j} ra\n`;
          resolvedLiterals.push(null);
        } else if (expected & CON_NATIVE_FLAGS.FUNCTION) {
          // For FUNCTION, generate code normally and keep it at argCode
          argCode += this.visitExpression(args[i] as Expression, context);
          argCode += `set r${j} ra\n`;
          resolvedLiterals.push(null);
        } else if (expected & (CON_NATIVE_FLAGS.OBJECT | CON_NATIVE_FLAGS.ARRAY)) {
          // For OBJECT and ARRAY, the next register sets what type of address we are dealing with
          code += this.visitExpression(args[i] as Expression, context);
          code += `set r${j} ra\n`;
          j++;
          code += `set r${j} 0\nife rf 1\n set r${j} 1\n`
          resolvedLiterals.push(null);
        } else {
          code += this.visitExpression(args[i] as Expression, context);
          code += `set r${j} ra\n`;
          resolvedLiterals.push(null);
        }
      }

      if(nativeFn.type_belong) {
        code += `set ri rbp\nadd ri ${variable.offset}\nset r${argsLen - 1} flat[ri]\n`;
        if(nativeFn.type_belong.includes('string') && nativeFn.return_type == 'string')
          context.stringExpr = true;
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
        if (args.length > 0) {
          code += `state popr${argsLen > 12 ? 'all' : argsLen}\n`;
          context.localVarCount -= argsLen;
        }
      } else {
        // For complex functions, call the arrow function.
        const fnCode = nativeFn.code(args.length > 0, argCode);
        code += fnCode + "\n";
        if (args.length > 0) {
          code += `state popr${argsLen > 12 ? 'all' : argsLen}\n`;
          context.localVarCount -= argsLen;
        }
      }
    } else {
      const fnName = fnNameRaw.startsWith("this.") ? fnNameRaw.substring(5) : fnNameRaw;
      const func = context.symbolTable.get(fnName);

      if (!func) {
        addDiagnostic(call, context, 'error', `Invalid function ${fnNameRaw}`);
        return '';
      }
      // If not native, assume it's a user function state
      if (args.length > 0) {
        code += `state pushr${args.length > 12 ? 'all' : args.length}\n`;
        context.localVarCount += args.length;
      }
      for (let i = 0; i < args.length; i++) {
        code += this.visitExpression(args[i] as Expression, context);
        code += `set r${i} ra\n`;
        resolvedLiterals.push(null);
      }

      code += `state ${func.CON_code ? func.CON_code : func.name}\nset ra rb\n`;
      if (args.length > 0) {
        code += `state popr${args.length > 12 ? 'all' : args.length}\n`;
        context.localVarCount -= args.length;
      }
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
    let code = this.options.lineDetail ? `/* Object literal: ${objLit.getText()} */\n` : '';

    // Reserve one slot for the object's base pointer.
    code += `add rsp 1\nset ri rsp\nadd ri 1\nsetarray flat[rsp] ri\n`;
    // The object's base pointer is now stored at flat[rsp].

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
            return (p as any).getName().replace(/[`'"]/g, "") === propName;
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
            const instanceType = context.typeAliases.get(baseType);
            if (instanceType) {
              const result = this.getObjectTypeLayout(baseType, context);
              for (let j = 0; j < count; j++) {
                for (let k = 0; k < instanceSize; k++) {
                  code += `set ra 0\nadd rsp 1\nsetarray flat[rsp] ra\n`;
                  totalSlots++;
                }
              }

              layout[propName] = {
                name: propName,
                type: "array",
                offset: totalSlots - (count * instanceSize),
                size: count * instanceSize,
                num_elements: count,
                children: { ...result }  // clone children as plain object
              };
            } else {
              // For each element, allocate instanceSize slots.
              for (let j = 0; j < count; j++) {
                for (let k = 0; k < instanceSize; k++) {
                  code += `set ra 0\nadd rsp 1\nsetarray flat[rsp] ra\n`;
                  totalSlots++;
                }
              }
              layout[propName] = {
                name: propName,
                type: "array",
                offset: totalSlots - (count * instanceSize),
                size: count * instanceSize,
                num_elements: count,
              };
            }
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
            code += `add rsp 1\nsetarray flat[rsp] ra\n`;
            layout[propName] = { name: propName, type: "number", offset: totalSlots, size: 1 };
          }
        } else {
          // Property not provided: default to 0.
          code += `set ra 0\nadd rsp 1\nsetarray flat[rsp] ra\n`;
          layout[propName] = { name: propName, type: "number", offset: totalSlots, size: 1 };
        }
      }
    } else {
      //addDiagnostic(objLit, context, "warning", `No type alias found for object literal; assuming empty object.`);
      const props = objLit.getProperties();

      for (const p of props) {
        totalSlots++;
        if (p.isKind(SyntaxKind.PropertyAssignment)) {
          const init = p.getInitializerOrThrow();
          const propName = p.getName().replace(/[`'"]/g, "");
          if (init.isKind(SyntaxKind.ArrayLiteralExpression)) {
            const initText = init.getText();
            const count = this.getArraySize(initText);
            //const instanceSize = this.getObjectSize(baseType, context);
            // For each element, allocate instanceSize slots.
            for (let j = 0; j < count; j++) {
              code += `set ra 0\nadd rsp 1\nsetarray flat[rsp] ra\n`;
              totalSlots++;
            }
            layout[propName] = {
              name: propName,
              type: "array",
              offset: totalSlots - (count),
              size: count,
              num_elements: count,
            };
          } else if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
            // For a nested object property.
            const result = this.processObjectLiteral(init, context);
            code += result.code;
            const nestedSize = result.size;
            layout[p.getName()] = {
              name: propName,
              type: "object",
              offset: totalSlots,
              size: nestedSize,
              children: { ...result.layout }  // clone children as plain object
            };
            totalSlots += nestedSize - 1; // already counted one slot for the property
          } else {
            // For a primitive property.
            code += this.visitExpression(init, context);
            code += `add rsp 1\nsetarray flat[rsp] ra\n`;
            layout[propName] = { name: propName, type: "number", offset: totalSlots, size: 1 };
          }
        } else
          addDiagnostic(objLit, context, "error", `No property assignmetn found during object declaration: ${objLit.getText()}`);
      }

    }

    // The object's base pointer is at: flat[rsp - (totalSlots + 1)]
    //code += `set ri rbp\nadd ri ${totalSlots + 1}\nset ra flat[ri]\n`;

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
      context.symbolTable.set(varName, { name: varName, type: "object", offset: context.localVarCount + 1, size: result.size, children: result.layout });
    }
    context.localVarCount += result.size + 1;
    return result.code + `set ra rbp\nadd ra ${context.localVarCount - result.size}\nset rf 0\n`;
  }

  private unrollMemberExpression(expr: Expression): MemberSegment[] {
    const segments: MemberSegment[] = [];

    function climb(e: Expression) {
      // For property access: objectExpression.propertyName
      if (e.isKind(SyntaxKind.PropertyAccessExpression)) {
        const pae = e as PropertyAccessExpression;
        // Recurse first on the object expression
        climb(pae.getExpression());
        // Then add the property name
        segments.push({
          kind: "property",
          name: pae.getName(),
        });
      }
      // For element access: objectExpression[indexExpression]
      else if (e.isKind(SyntaxKind.ElementAccessExpression)) {
        const eae = e as ElementAccessExpression;
        // Recurse on the object expression
        climb(eae.getExpression());
        // Then add the index expression
        segments.push({
          kind: "index",
          expr: eae.getArgumentExpressionOrThrow(),
        });
      }
      // For a simple identifier: e.g. "foo"
      else if (e.isKind(SyntaxKind.Identifier)) {
        segments.push({
          kind: "identifier",
          name: e.getText(),
        });
      }
      // For "this"
      else if (e.isKind(SyntaxKind.ThisKeyword)) {
        segments.push({
          kind: "this",
          name: "this",
        });
      }
      // Fallback for other expressions you might hit (parenthesized, etc.)
      else {
        // You can handle or flatten further, or store them as a single “identifier”:
        segments.push({
          kind: "identifier",
          name: e.getText(),
        });
      }
    }

    climb(expr);
    return segments;
  }

  private visitMemberExpression(expr: Expression, context: TranspilerContext, assignment?: boolean, direct?: boolean): string {
    let code = this.options.lineDetail ? `/* ${expr.getText()} */\n` : '';
    const segments = this.unrollMemberExpression(expr);

    if (segments.length === 0) {
      addDiagnostic(expr, context, "warning", `No segments found for expression: ${expr.getText()}`);
      return "set ra 0\n";
    }

    // Handle the object
    const obj = segments[0] as SegmentIdentifier;
    let sym: SymbolDefinition | null = null;
    if (obj.kind == 'identifier' && ['sprites', 'sectors', 'walls', 'players', 'Names', 'EMoveFlags'].indexOf(obj.name) == -1) {
      sym = context.symbolTable.get(obj.name);
      if (!sym) {
        addDiagnostic(expr, context, "error", `Undefined object: ${expr.getText()}`);
        return "set ra 0\n";
      }

      if(sym.type == 'string') {
        if(segments[1].kind == 'property' && segments[1].name == 'length')
          return code + `set ri rbp\nadd ri ${sym.offset}\nset ri flat[ri]\nset ra flat[ri]\n`;
      }

      if (!sym.native_pointer) {
        code += `set ri rbp\nadd ri ${sym.offset}\n`;
        code += `set ri flat[ri]\n`;

        for (let i = 1; i < segments.length; i++) {
          const seg = segments[i];
          if (seg.kind == 'index') {
            if (sym.type != 'array') {
              addDiagnostic(expr, context, "error", `Indexing a non array variable: ${expr.getText()}`);
              return "set ra 0\n";
            }

            const localVars = context.localVarCount;
            //code += `state pushd\n`
            code += this.visitExpression(seg.expr, context);
            if (localVars != context.localVarCount) {
              code += `sub rsp ${localVars - context.localVarCount}\n`;
              code += `add rsp 1\n` //Account for the push rd we did back there
              context.localVarCount = localVars;
            }
            code += `mul ra ${sym.size / sym.num_elements}\nadd ri ra\n`
            continue;
          }

          if (seg.kind == 'property') {
            if (!sym.children) {
              addDiagnostic(expr, context, "error", `Object property ${seg.name} is not a object: ${expr.getText()}`);
              return "set ra 0\n";
            }

            if (!sym.children[seg.name]) {
              addDiagnostic(expr, context, "error", `Property ${seg.name} not found in: ${expr.getText()}`);
              return "set ra 0\n";
            }

            sym = sym.children[seg.name];

            code += `add ri ${sym.offset}\n`;
            continue;
          }
        }

        if (assignment)
          code += `setarray flat[ri] ra\n`;
        else
          code += `set ra flat[ri]\n`;
        return code;
      }
    }

    if (obj.kind == 'identifier' || obj.kind == 'this') {
      switch (obj.name) {
        case 'Names':
          if (direct)
            return Names[(segments[1] as SegmentProperty).name];

          code += `set ra ${Names[(segments[1] as SegmentProperty).name]}\n`;
          return code;

        case 'EMoveFlags':
          if (direct)
            return Names[(segments[1] as SegmentProperty).name];

          code += `set ra ${EMoveFlags[(segments[1] as SegmentProperty).name]}\n`;
          return code;

        default: //sprites, sectors, walls or other enums
          if (obj.kind != 'this') {
            //Check if it's a enum

            const e = context.enums.get(obj.name);

            if (e) {
              const seg = segments[1] as SegmentProperty
              if (direct)
                return String(e.members[seg.name]);

              code += `set ra ${e.members[seg.name]}\n`;
              return code;
            }

            if (segments[1].kind != 'index' && (sym && !sym.native_pointer_index)) {
              addDiagnostic(expr, context, "error", `Missing index for ${obj.name}: ${expr.getText()}`);
              return "set ra 0\n";
            }
            if (segments[1].kind == 'index') {
              code += this.visitExpression(segments[1].expr, context);
              code += `set ri ra\n`;
            }
          } else {
            code += `set ri THISACTOR\n`;
            if (context.currentActorPicnum)
              obj.name = 'sprites';
          }

          //Go no further, it just wants the reference
          if (segments.length == 2 && segments[1].kind == 'index') {
            context.localVarNativePointer = obj.name as any;
            context.localVarNativePointerIndexed = true,
              code += `set ra ri\n`;
            return code;
          }

          const seg = segments[obj.kind == 'this' || (sym && sym.native_pointer_index) ? 1 : 2];
          let op = '';

          if (sym && sym.native_pointer) {
            obj.name = sym.native_pointer;

            if (sym.native_pointer_index)
              code += `set ri rbp\nadd ri ${sym.offset}\nset ri flat[ri]\n`;
          }

          if (seg.kind == 'property') {
            let nativeVar: CON_NATIVE_VAR[];

            switch (obj.name) {
              case 'sprites':
                nativeVar = nativeVars_Sprites;
                op = 'a';
                break;

              case 'sectors':
                nativeVar = nativeVars_Sectors;
                op = 'sector';
                break;

              case 'walls':
                nativeVar = nativeVars_Walls;
                op = 'wall';
                break;
            }

            let nVar = nativeVar.find(e => e.name == seg.name);

            if (!nVar) {
              addDiagnostic(expr, context, "error", `Property ${seg.name} not found in ${obj.name}: ${expr.getText()}`);
              return "set ra 0\n";
            }

            let overriden = false;

            if (nVar.type == CON_NATIVE_FLAGS.OBJECT) {
              let v = nVar.object;

              for (let i = 3; i < segments.length; i++) {
                const s = segments[i];

                if (nVar.var_type == CON_NATIVE_TYPE.array) {
                  if (s.kind != 'index') {
                    addDiagnostic(expr, context, "error", `Missing index for ${seg.name}: ${expr.getText()}`);
                    return "set ra 0\n";
                  }

                  code += this.visitExpression(s.expr, context);
                  if (nVar.override_code) {
                    code += nVar.code[assignment ? 1 : 0];
                    overriden = true;
                  }

                  if (nVar.type == CON_NATIVE_FLAGS.OBJECT) {
                    const v = nVar.object.find(e => e.name == (segments[i + 1] as SegmentProperty).name);

                    if (!v) {
                      addDiagnostic(expr, context, "error", `Segment ${(segments[i + 1] as SegmentProperty).name} is not a property of ${seg.name}: ${expr.getText()}`);
                      return "set ra 0\n";
                    }

                    nVar = v;
                    i++;
                  }

                  continue;
                }

                if (nVar.var_type == CON_NATIVE_TYPE.object) {
                  if (s.kind != 'property') {
                    addDiagnostic(expr, context, "error", `Segment after ${seg.name} is not a property: ${expr.getText()}`);
                    return "set ra 0\n";
                  }

                  const v = nVar.object.find(e => e.name == s.name);

                  if (!v) {
                    addDiagnostic(expr, context, "error", `Segment ${s.name} is not a property of ${seg.name}: ${expr.getText()}`);
                    return "set ra 0\n";
                  }

                  if (v.var_type == CON_NATIVE_TYPE.native) {
                    if (!overriden)
                      code += `${assignment ? 'state pop\nset' : 'get'}${op}[ri].`;

                    code += `${v.code} ra\n`;
                  }

                  if (v.var_type == CON_NATIVE_TYPE.object)
                    nVar = v;
                }
              }
            } else if (nVar.type == CON_NATIVE_FLAGS.VARIABLE) {
              if (nVar.var_type == CON_NATIVE_TYPE.native) {
                if (!overriden)
                  code += `${assignment ? 'state pop\nset' : 'get'}${op}[ri].`;

                code += `${nVar.code} ra\n`;
              } else code += `set ${assignment ? ('state pop\n' + nVar.code + ' ra\n')
                : ('ra ' + nVar.code + '\n')}`
            }
          }

          return code;
      }
    }

    addDiagnostic(expr, context, "warning", `Unhandled member expression: ${expr.getText()}`);
    code += `set ra 0\n`;
    return code;
  }


  private visitUnaryExpression(expr: Expression, context: TranspilerContext): string {
    let code = this.options.lineDetail ? `// unary: ${expr.getText()}\n` : '';
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
          code += `mul ra -1\n`;
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
    let code = `${this.options.lineDetail ? `/*${fd.getText()}*/` : ''}\ndefstate ${name}\n  set ra rbp \n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;
    fd.getParameters().forEach((p, i) => {
      localCtx.paramMap[p.getName()] = i;
    });

    context.symbolTable.set(name, {
      name: `${name}`,
      type: 'function',
      offset: 0
    });

    localCtx.symbolTable.set(name, {
      name: `${name}`,
      type: 'function',
      offset: 0
    });

    if(context.currentFile.options & ECompileOptions.state_decl) {
      const t = fd.getReturnType();
      if(t.getAliasSymbol().getName() == 'CON_NATIVE') {
        const args = t.getAliasTypeArguments();

        if(args.length > 0) {
          localCtx.symbolTable.get(name).CON_code = args[0].getText().replace(/[`'"]/g, "");
          context.symbolTable.get(name).CON_code = args[0].getText().replace(/[`'"]/g, "");
        }
      }
    }

    const body = fd.getBody() as any;
    if (body) {
      body.getStatements().forEach(st => {
        code += indent(this.visitStatement(st, localCtx), 1) + "\n";
      });
    }
    code += `  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\nends \n\n`;
    return code;
  }

  /******************************************************************************
   * VISIT CLASS DECL => if extends CActor => parse constructor => skip code => gather actions
   ****************************************************************************/
  private visitClassDeclaration(cd: ClassDeclaration, context: TranspilerContext): string {
    const className = cd.getName() || "AnonClass";
    let code = this.options.lineDetail ? `// class ${className}\n` : '';

    const base = cd.getExtends()?.getExpression().getText() || "";
    const type = base;
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
      code += this.visitConstructorDeclaration(ctors[0], localCtx, type);
    }

    // if CActor => append the actions/moves/ais lines
    if (type == 'CActor') {
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

    // visit properties
    const properties = cd.getProperties();

    for (const p of properties) {
      if (p.getTypeNode().getText() == 'OnEvent') {
        const init = p.getInitializerOrThrow();

        if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const events = init.getProperties();

          for (const e of events) {
            if (!e.isKind(SyntaxKind.MethodDeclaration)) {
              addDiagnostic(e, context, 'error', `OnEvent property must only contain functions: ${p.getText()}`);
              return '';
            }

            const eFnName = e.getName();

            if (!EventList.includes(eFnName as TEvents)) {
              addDiagnostic(e, context, 'error', `Invalid event ${e.getName()}: ${p.getText()}`);
              return '';
            }

            const evntLocalCtx: TranspilerContext = {
              ...localCtx,
              localVarOffset: {},
              localVarCount: 0,
              paramMap: {}
            };

            code += `${this.options.lineDetail ? `\n/*${e.getText()}*/` : ''}\nonevent EVENT_${eFnName.toUpperCase()}\nset ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n  ifactor ${localCtx.currentActorPicnum} {\n`;
            const body = e.getBody() as any;
            if (body) {
              const stmts = body.getStatements() as Statement[];

              stmts.forEach(s => {
                code += this.visitStatement(s, evntLocalCtx);
              });
            }

            code += `  }\n  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nendevent \n\n`;
          }
        }
      }
    }

    // visit methods
    const methods = cd.getInstanceMethods();
    for (const m of methods) {
      code += this.visitMethodDeclaration(m, className, localCtx, type);
    }

    return code;
  }

  /******************************************************************************
   * CONSTRUCTOR => skip code, parse object literals for IAction, IMove, IAi, parse super(...) for picnum
   ****************************************************************************/
  private visitConstructorDeclaration(
    ctor: ConstructorDeclaration,
    context: TranspilerContext,
    type: string
  ): string {
    let code = this.options.lineDetail ? `// skipping actual constructor code\n` : '';
    const body = ctor.getBody() as any;
    if (body) {
      if (type == 'CActor') {
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
      } else if (type == 'CEvent') {
        const statements = body.getStatements();
        for (const st of statements) {
          // e.g. variable statements => might define IAction, IMove, IAi
          // expression => maybe super(...)
          if (st.isKind(SyntaxKind.ExpressionStatement)) {
            const es = st as ExpressionStatement;
            const expr = es.getExpression();
            if (expr.isKind(SyntaxKind.CallExpression)) {
              const call = expr as CallExpression;
              if (call.getExpression().getText() === "super") {
                const arg = call.getArguments();

                if (arg.length > 1)
                  addDiagnostic(call, context, 'warning', `Too many arguments in Event Constructor: ${call.getText()}`);

                if (!arg[0].isKind(SyntaxKind.StringLiteral)) {
                  addDiagnostic(call, context, 'error', `First argument of Event constructor must be the event name: ${call.getText()}`);
                  return '';
                }

                const eventName = arg[0].getText().replace(/[`'"]/g, "");

                if (!EventList.includes(eventName as TEvents)) {
                  addDiagnostic(call, context, 'error', `Event ${eventName} is not valid: ${call.getText()}`);
                  return '';
                }

                context.currentEventName = eventName.toUpperCase();
                context.currentActorPicnum = undefined;
              }
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
          case "name": actionName = val.getText().replace(/[`'"]/g, ""); break;
          case "start": start = parseInt(val.getText(), 10); break;
          case "length": length = parseInt(val.getText(), 10); break;
          case "viewType": viewType = parseInt(val.getText(), 10); break;
          case "incValue": incValue = parseInt(val.getText(), 10); break;
          case "delay": delay = parseInt(val.getText(), 10); break;
        }
      }
    });
    context.symbolTable.set(decl.getName(), {
      name: actionName,
      type: 'pointer',
      offset: 0,
      size: 1,
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
          case "name": moveName = val.getText().replace(/[`'"]/g, ""); break;
          case "horizontal_vel": hv = parseInt(val.getText(), 10); break;
          case "vertical_vel": vv = parseInt(val.getText(), 10); break;
        }
      }
    });
    context.symbolTable.set(decl.getName(), {
      name: moveName,
      type: 'pointer',
      offset: 0,
      size: 1,
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
          case "name": aiName = val.getText().replace(/[`'"]/g, ""); break;
          case "action": actionLabel = val.getText().replace(/[`'"]/g, ""); break;
          case "move": moveLabel = val.getText().replace(/[`'"]/g, ""); break;
          case "flags": flags = evalMoveFlags(val, context); break;
        }
      }
    });
    context.symbolTable.set(decl.getName(), {
      name: aiName,
      type: 'pointer',
      offset: 0,
      size: 1,
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
      context.currentActorFirstAction = context.symbolTable.get(fa.getText()).name.replace(/[`'"]/g, "");
    }
  }

  /******************************************************************************
   * visitMethodDeclaration => if main() => useractor ...
   ****************************************************************************/
  private visitMethodDeclaration(
    md: MethodDeclaration,
    className: string,
    context: TranspilerContext,
    type: string
  ): string {
    const mName = md.getName();
    const localCtx: TranspilerContext = {
      ...context,
      localVarOffset: {},
      localVarCount: 0,
      paramMap: {}
    };

    if (type == 'CActor' && mName.toLowerCase() === "main") {
      const pic = localCtx.currentActorPicnum || 0;
      const extra = localCtx.currentActorExtra || 0;
      const firstAction = localCtx.currentActorFirstAction || "0";
      const enemy = localCtx.currentActorIsEnemy ? 1 : 0;
      let code = `${this.options.lineDetail ? `/*${md.getText()}*/` : ''}\nuseractor ${enemy} ${pic} ${extra} ${firstAction} \n  findplayer playerDist\n  set ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;
      md.getParameters().forEach((p, i) => {
        localCtx.paramMap[p.getName()] = i;
      });
      const body = md.getBody() as any;
      if (body) {
        body.getStatements().forEach(st => {
          code += indent(this.visitStatement(st, localCtx), 1) + "\n";
        });
      }
      code += `  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nenda \n\n`;
      return code;
    } else if (type == 'CEvent' && (mName.toLowerCase() == 'append' || mName.toLowerCase() == 'prepend')) {
      let code = `${this.options.lineDetail ? `/*${md.getText()}*/` : ''}\n${mName.toLowerCase() == 'append' ? 'append' : 'on'}event EVENT_${context.currentEventName}\n  set ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;
      const body = md.getBody() as any;
      if (body) {
        body.getStatements().forEach(st => {
          code += indent(this.visitStatement(st, localCtx), 1) + "\n";
        });
      }
      code += `  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nendevent \n\n`;
      return code;
    }

    // otherwise => normal state
    let code = `${this.options.lineDetail ? `/*${md.getText()}*/` : ''}\ndefstate ${className}_${mName} \n  set ra rbp \n  state push \n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;

    md.getParameters().forEach((p, i) => {
      localCtx.paramMap[p.getName()] = i;
    });

    context.symbolTable.set(mName, {
      name: `${className}_${mName}`,
      type: 'function',
      offset: 0
    });

    localCtx.symbolTable.set(mName, {
      name: `${className}_${mName}`,
      type: 'function',
      offset: 0
    });

    const body = md.getBody() as any;
    if (body) {
      body.getStatements().forEach(st => {
        code += indent(this.visitStatement(st, localCtx), 1) + "\n";
      });
    }
    code += `  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\nends \n\n`;
    return code;
  }
}
