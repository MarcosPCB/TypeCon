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
  Identifier,
  ArrayLiteralExpression,
  WhileStatement,
  Type,
  TypeNode,
  TypeFlags,
  ModuleDeclarationKind,
  ArrowFunction,
  BodyableNode,
  PropertyDeclaration
} from "ts-morph";

import {
  CON_NATIVE_FLAGS,
  EMoveFlags,
  CON_NATIVE_TYPE,
  nativeVars_Sprites,
  CON_NATIVE_VAR,
  nativeVars_Sectors,
  nativeVars_Walls,
  nativeVarsList
} from '../../../sets/TCSet100/native';

import { EventList, TEvents } from "../types";

import { evalLiteral, findNativeFunction, findNativeVar_Sprite } from "../helper/helpers";
import { compiledFiles, ECompileOptions, ICompiledFile, pageSize } from "../helper/framework";


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

interface CompileDiagnostic {
  line: number;
  message: string;
  severity: DiagnosticSeverity;
}

interface CompilerOptions {
  debug?: boolean;
  lineDetail?: boolean;
}

enum EHeapType {
  array = 1,
  string = 2,
  object = 4,
  string_array = 8,
}

enum ESymbolType {
  error = 0,
  number = 1,
  string = 2,
  boolean = 4,
  object = 8,
  pointer = 16,
  function = 32,
  native = 64,
  quote = 128,
  class = 256,
  array = 512,
  null = 1024,
  module = 2048,
  enum = 4096,
  constant = 8192,
  not_compiled = 65536,
}

/**
 * Symbol definition for the symbol table.
 * Holds every bit of necessary information about the symbols (variables, functions, classes, objects, arrays and etc.)
 * 
 * @property {string} name - The name of the symbol
 * @property {ESymbolType} type - The type of the symbol
 * @property {number} offset - The current offset of the symbol
 * @property {number} size - (optional) The total size of the symbol
 * @property {number} num_elements - (optional) The total number of elements that belong to this symbol
 * @property {boolean} heap - (optional) If it belongs to the heap or not
 * @property {'sprites' | 'sectors' | 'walls' | 'players' | 'projectiles'} native_pointer - (optional) If it's native pointer (holding a native reference) this should hold which structure it is referencing
 * @property {boolean} native_pointer_index - (optional) True if its a indexed native pointer (sprites[2])
 * @property {[key: string]: SymbolDefinition} children - (optional) Hold data about its children symbols
 * @property {string} CON_code - (optional) Holds the CON code of the symbol
 */
interface SymbolDefinition {
  name: string;
  type: Exclude<ESymbolType, ESymbolType.enum>;
  offset: number;        // Delta from the object's base pointer
  size?: number;         // How many slots this symbol occupies.
  num_elements?: number;
  heap?: boolean,
  global?: boolean,
  readonly?: boolean,
  native_pointer?: 'sprites' | 'sectors' | 'walls' | 'players' | 'projectiles',
  //This is only used IF we do something like 'const s = sprites[2]', 
  //otherwise, the compiler treats like a pointer to the complete array structure: 'const s = sprites'
  native_pointer_index?: boolean,
  children?: { [key: string]: SymbolDefinition | EnumDefinition }; // For nested objects.
  CON_code?: string,
  returns?: Exclude<ESymbolType, ESymbolType.enum> | null;
  literal?: string | number | null;
}

interface TypeAliasDefinition {
  name: string;
  members: Record<string, string>; // property name -> type (as a string)
  literal?: string;
  union?: TypeAliasDefinition;
  membersCode?: Record<string, string>;
}

interface EnumDefinition {
  name: string,
  type: ESymbolType.enum,
  children: Record<string, number>
}

/** 
 * The compiler context, storing local var offsets, param maps, 
 * plus info about CActor if we are in one, etc.
 */
export interface CompilerContext {
  localVarOffset: Record<string, number>;
  localVarCount: number;
  localVarNativePointer: 'sprites' | 'sectors' | 'walls' | 'players' | 'projectiles' | undefined, //Only true if you're passing a native pointer to a local variable
  localVarNativePointerIndexed: boolean,
  paramMap: Record<string, SymbolDefinition>;

  globalVarCount: number,

  diagnostics: CompileDiagnostic[];

  options: CompilerOptions;

  // For CActor:
  currentActorPicnum?: number;
  currentActorExtra?: number;
  currentActorIsEnemy?: boolean;
  currentActorFirstAction?: string;
  currentActorActions: string[];
  currentActorMoves: string[];
  currentActorAis: string[];
  currentActorLabels: Record<string, SymbolDefinition>;

  // For event classes if needed
  currentEventName?: string;

  // New field to store type aliases:
  typeAliases: Map<string, TypeAliasDefinition>;

  // Current custom class
  curClass: SymbolDefinition;

  // Current function/method being declared
  curFunc: SymbolDefinition;

  // Current module/namespace
  curModule: SymbolDefinition;

  // New symbol table for object layouts (global or per–scope)
  symbolTable: Map<string, SymbolDefinition | EnumDefinition>;

  currentFile: ICompiledFile;

  // Last expression
  curExpr: Exclude<ESymbolType, ESymbolType.enum>;

  // Last symbol returned
  curSymRet: SymbolDefinition;

  isInLoop: boolean;
  mainBFunc: boolean;

  initCode: string;

  inSwitch: boolean;
  hasLocalVars: boolean;
  usingRD: boolean;
}

export interface CompileResult {
  conOutput: string;
  diagnostics: CompileDiagnostic[];
  context: CompilerContext
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

/******************************************************************************
 * INDENT UTILITY
 *****************************************************************************/
export function indent(text: string, level: number): string {
  const pad = "  ".repeat(level);
  return text
    .split("\n")
    .map(line => (line.trim() ? pad + line : line))
    .join("\n");
}

/******************************************************************************
 * MAIN COMPILER CLASS
 *****************************************************************************/
export class TsToConCompiler {
  private project: Project;
  private options: CompilerOptions;

  constructor(options: CompilerOptions = {}) {
    this.options = options;
    this.project = new Project({ useInMemoryFileSystem: true });
  }

  public compile(sourceCode: string, file: string, prvContext?: CompilerContext): CompileResult {
    const sf = this.project.createSourceFile(`temp_${Buffer.from(file).toString('base64url')}.ts`, sourceCode, {
      overwrite: true
    });

    const context: CompilerContext = prvContext ? prvContext : {
      localVarOffset: {},
      localVarCount: 0,
      localVarNativePointer: undefined,
      localVarNativePointerIndexed: false,
      paramMap: {},
      diagnostics: [],
      options: this.options,

      globalVarCount: 0,

      curClass: null,
      curFunc: null,
      curModule: null,

      currentActorPicnum: undefined,
      currentActorExtra: undefined,
      currentActorIsEnemy: undefined,
      currentActorFirstAction: undefined,
      currentActorActions: [],
      currentActorMoves: [],
      currentActorAis: [],
      currentEventName: undefined,
      currentActorLabels: {},
      typeAliases: new Map(),
      symbolTable: new Map(),
      currentFile: undefined,
      curExpr: ESymbolType.number,
      curSymRet: null,
      isInLoop: false,
      mainBFunc: false,

      initCode: '',
      inSwitch: false,
      hasLocalVars: false,
      usingRD: false
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
          this.compile(sCode.toString(), resolved, context);
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

        if (modules.findIndex(e => e.getName() == 'statedecl') != -1) {
          console.log(`Reading functions as states...`);
          context.currentFile.options |= ECompileOptions.state_decl;
        }

        if (!(context.currentFile.options & ECompileOptions.state_decl)
          || !(context.currentFile.options & ECompileOptions.no_compile))
          console.log(`Compiling ${file}...`);
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

    /*if(context.currentFile.code.length != 0) {
      const str = context.currentFile.code;
      let pushes = 0, pops = 0, pos = 0;

      while(true) {
        const cur = str.indexOf('state push', pos);
        if(cur == -1)
          break;

        pushes++;
        pos = cur + String('state push').length;
      }

      pos = 0;
      while(true) {
        const cur = str.indexOf('state pop', pos);
        if(cur == -1)
          break;

        pops++;
        pos = cur + String('state pop').length;
      }

      if(pushes != pops) {
        context.diagnostics.push({
          severity: 'warning',
          line: 0,
          message: `Number of pushes doesn't match the number of pops: ${pushes} pushes x ${pops} pops`
        });
      }
    }*/

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
      diagnostics: context.diagnostics,
      context
    };
  }

  /**
 * Resolves a TypeNode (or anything that eventually points to it) to the
 * primitive “base” that the compiler cares about: `string`, `number`,
 * `boolean` or `object`.
 *
 * – If the node is a type‑alias, we follow the alias recursively.  
 * – If it is a union we make sure every member resolves to the **same**
 *   base (only homogeneous unions are allowed).  
 * – If it is, or resolves to, an object literal we cache its layout with
 *   `this.storeAliasType`.  
 * – When the type cannot be reduced to one of the four bases we emit a
 *   diagnostic and return `null`.
 */
  private getTypeBase(tn: TypeNode, ctx: CompilerContext): string | null {
    const type = tn.getType();

    /* ────────────────────────────────────────────────────────────────────
     * 1.  Unions – every member must collapse to the same base
     * ──────────────────────────────────────────────────────────────────── */
    if (type.isUnion()) {
      const bases = type.getUnionTypes()
        .map(u => this.baseFromType(u, ctx))
        .filter((b): b is string => !!b);

      const first = bases[0];
      const allSame = bases.every(b => b === first);

      if (!allSame) {
        addDiagnostic(tn, ctx, "error",
          `Union members must share the same base: ${type.getText()}`);
        return null;
      }
      return first;
    }

    /* ────────────────────────────────────────────────────────────────────
     * 2.  Primitives & literal primitives
     * ──────────────────────────────────────────────────────────────────── */
    if (type.isString() || type.isStringLiteral()) return "string";
    if (type.isNumber() || type.isNumberLiteral()) return "number";
    if (type.isBoolean() || type.isBooleanLiteral()) return "boolean";

    /* ────────────────────────────────────────────────────────────────────
     * 3.  Inline object literal  { a: string }
     * ──────────────────────────────────────────────────────────────────── */
    if (Node.isTypeLiteral(tn)) {
      this.storeTypeAlias(tn as unknown as TypeAliasDeclaration, ctx);   // unnamed literal
      return "object";
    }

    /* ────────────────────────────────────────────────────────────────────
     * 4.  Type references  Foo, Bar<Baz>, SomeInterface
     *     (includes aliases, interfaces, classes, generics…)
     * ──────────────────────────────────────────────────────────────────── */
    if (Node.isTypeReference(tn)) {
      const aliSym = type.getAliasSymbol();           // present only for aliases
      if (aliSym) {
        const aliasDecl = aliSym.getDeclarations()
          .find(Node.isTypeAliasDeclaration) as TypeAliasDeclaration | undefined;

        if (aliasDecl) {
          const aliasedNode = aliasDecl.getTypeNode();
          if (aliasedNode) {
            // cache literal shapes declared via alias
            if (Node.isTypeLiteral(aliasedNode)) {
              this.storeTypeAlias(aliasedNode as unknown as TypeAliasDeclaration, ctx);
            }
            return this.getTypeBase(aliasedNode, ctx);   // recurse
          }
        }
      }
      // Any other reference (interface, class, generic instantiation…)
      return "object";
    }

    /* ────────────────────────────────────────────────────────────────────
     * 5.  Fallback for plain object types
     * ──────────────────────────────────────────────────────────────────── */
    if (type.isObject()) return "object";

    /* ────────────────────────────────────────────────────────────────────
     * 6.  Unsupported
     * ──────────────────────────────────────────────────────────────────── */
    addDiagnostic(tn, ctx, "error",
      `Unsupported parameter type: ${type.getText()}`);
    return null;
  }

  /* -------------------------------------------------------------------- */
  /* Helper for reducing a ts-morph Type when we don’t have its node      */
  /* -------------------------------------------------------------------- */
  private baseFromType(t: Type, ctx: CompilerContext): string | null {
    const node = t.getSymbol()?.getDeclarations()?.find(Node.isTypeNode);
    if (node) return this.getTypeBase(node, ctx);

    // Literal types (`"foo"`, `42`) don’t have declarations; create one on‑the‑fly
    const sf = this.project.createSourceFile("__temp.ts", `type __T = ${t.getText()};`);
    const litNode = sf.getTypeAliasOrThrow("__T").getTypeNodeOrThrow();
    const base = this.getTypeBase(litNode, ctx);
    sf.delete();
    return base;
  }

  private storeTypeAlias(ta: TypeAliasDeclaration, context: CompilerContext): void {
    const aliasName = ta.getName();
    const typeNode = ta.getTypeNode();

    if (!typeNode || !typeNode.isKind(SyntaxKind.TypeLiteral)) {
      if (typeNode) {
        if (['OnEvent', 'constant', 'TLabel', 'CON_NATIVE', 'CON_NATIVE_POINTER', 'quote', 'TAction', 'TMove', 'TAi', 'OnVariation'].includes(aliasName))
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

  private storeInterface(id: InterfaceDeclaration, context: CompilerContext): void {
    const aliasName = id.getName();

    const members: Record<string, string> = {};
    const membersCode: Record<string, string> = {};
    id.getMembers().forEach((member, i) => {
      if (member.getKind() === SyntaxKind.PropertySignature) {
        const prop = member as PropertySignature;
        if (prop.getType().getAliasSymbol() && prop.getType().getAliasSymbol().getName() == 'CON_NATIVE_GAMEVAR') {
          const type = prop.getType().getAliasTypeArguments()[1].getText().replace(/[`'"]/g, "");
          const code = prop.getType().getAliasTypeArguments()[0].getText().replace(/[`'"]/g, "");
          members[prop.getName()] = type;
          membersCode[prop.getName()] = code;
        } else members[prop.getName()] = prop.getType().getText();
      }
    });
    context.typeAliases.set(aliasName, { name: aliasName, members, membersCode });
  }

  private storeEnum(ed: EnumDeclaration, context: CompilerContext): void {
    const name = ed.getName();

    const members: Record<string, number> = {};
    ed.getMembers().forEach((member, i) => {
      if (member.getKind() === SyntaxKind.EnumMember) {
        const prop = member as EnumMember;
        members[prop.getName()] = prop.getValue() as number;
      }
    });
    context.symbolTable.set(name, { name: name, type: ESymbolType.enum, children: members } as EnumDefinition);
  }

  private getObjectSize(typeName: string, context: CompilerContext): number {
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

  private getSymbolType(type: string, context: CompilerContext): ESymbolType {
    let t: Exclude<ESymbolType, ESymbolType.enum> = ESymbolType.number;
    switch (type) {
      case 'string':
      case 'pointer':
      case 'boolean':
        t = ESymbolType[type];
        break;

      case 'constant':
      case 'number':
        break;

      case 'quote':
        t = ESymbolType.quote;
        break;

      case 'string[]':
        t = ESymbolType.string | ESymbolType.array;
        break;

      case 'number[]':
      case '[]':
      case 'any[]':
        t = ESymbolType.array;
        break;

      default:
        let tText = type;

        if (type.endsWith('[]')) {
          t = ESymbolType.object | ESymbolType.array;
          tText = tText.slice(0, tText.length - 2);
        } else t = ESymbolType.object;

        const alias = context.typeAliases.get(tText);

        if (!alias)
          return ESymbolType.error;
    }

    return t;
  }

  private getObjectTypeLayout(typeName: string, context: CompilerContext): { [key: string]: SymbolDefinition } {
    if (context.typeAliases.has(typeName)) {
      const typeDef = context.typeAliases.get(typeName)!;
      let layout: { [key: string]: SymbolDefinition } = {};
      const keys = Object.keys(typeDef.members);
      for (let i = 0; i < keys.length; i++) {
        const t = typeDef.members[keys[i]];
        const code = typeDef.membersCode ? typeDef.membersCode[keys[i]] : undefined;
        const k = keys[i];
        let children: Record<string, SymbolDefinition> = undefined;
        // If the member is an array type (e.g., "wow[]")
        if (t.endsWith("[]")) {
          // Strip the brackets to get the base type.
          const baseType = t.slice(0, -2).trim();
          // Recursively compute the layout for one element of the array.
          if (context.typeAliases.has(baseType)) {
            children = this.getObjectTypeLayout(baseType, context);
            layout[k] = {
              name: k,
              //@ts-ignore
              type: this.getSymbolType(t, context),
              offset: i,
              size: this.getObjectSize(baseType, context),
              num_elements: Object.keys(children).length,
              children
            };
          } else {
            layout[k] = {
              name: k,
              //@ts-ignore
              type: this.getSymbolType(t, context),
              offset: i,
              size: 1,
              children
            };
          }
        } else {
          if (context.typeAliases.has(t))
            children = this.getObjectTypeLayout(t, context);

          layout[k] = {
            name: k,
            //@ts-ignore
            type: this.getSymbolType(t, context),
            offset: i,
            size: context.typeAliases.has(t) ? this.getObjectSize(t, context) : 1,
            num_elements: context.typeAliases.has(t) ? Object.keys(children).length : 1,
            CON_code: code,
            children
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
  private visitStatement(stmt: Statement, context: CompilerContext): string {
    let code = ''//`/* ${stmt.getText()} */\n`;
    switch (stmt.getKind()) {
      case SyntaxKind.VariableStatement:
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

      case SyntaxKind.BreakStatement: {
        if (context.isInLoop)
          code += `exit\n`;
        else
          code += `state popb\njump rb\n`; //switch statements

        return code;
      }

      case SyntaxKind.ModuleDeclaration:
        const md = stmt as ModuleDeclaration;

        const curModule = context.curModule;

        const b = context.currentFile.options;
        const moduleName = md.getName();
        const compilable = md.getDeclarationKind() != ModuleDeclarationKind.Global && !['nocompile', 'noread', 'statedecl'].includes(moduleName);

        if (!compilable)
          context.currentFile.options |= ECompileOptions.no_compile;

        const stmts = (stmt as ModuleDeclaration).getStatements();

        if (compilable)
          context.symbolTable.set(moduleName, {
            name: moduleName,
            type: ESymbolType.module,
            offset: 0
          });

        const localCtx: CompilerContext = {
          ...context,
          symbolTable: new Map(context.symbolTable),
          curModule: compilable ? context.symbolTable.get(moduleName) as SymbolDefinition : curModule
        };

        let mCode = '';

        stmts.forEach(st => {
          if (!st.isKind(SyntaxKind.ClassDeclaration))
            mCode += this.visitStatement(st, localCtx);
        });

        if (compilable) {
          const children: { [k: string]: SymbolDefinition | EnumDefinition } = Object.fromEntries([...localCtx.symbolTable].filter(e => !context.symbolTable.has(e[0])));

          context.symbolTable.set(moduleName, {
            name: moduleName,
            type: ESymbolType.module,
            offset: 0,
            children
          });

          code += mCode;
        } else {
          context.symbolTable = localCtx.symbolTable;
          context.typeAliases = localCtx.typeAliases;
        }

        context.curModule = curModule;

        context.currentFile.options = b;
        return code;

      case SyntaxKind.ImportDeclaration:
        return code;

      case SyntaxKind.FunctionDeclaration:
        return code + this.visitFunctionDeclaration(stmt as FunctionDeclaration, context);

      case SyntaxKind.WhileStatement:
        return code + this.visitWhileStatement(stmt as WhileStatement, context);

      case SyntaxKind.ExportAssignment:
        return '';

      default:
        addDiagnostic(stmt, context, "warning", `Unhandled statement kind: ${stmt.getKindName()} - ${stmt.getText()}`);
        return code;
    }
  }

  /******************************************************************************
   * while statements
   *****************************************************************************/
  private visitWhileStatement(ws: WhileStatement, context: CompilerContext): string {
    let code = this.options.lineDetail ? `/*${ws.getText()}*/\n` : '';

    context.isInLoop = true;

    const useRD = context.usingRD;
    context.usingRD = true;

    if(useRD)
      code += `state pushd\n`;

    const pattern = this.parseIfCondition(ws.getExpression(), context);
    const right = typeof pattern.right === 'number' ? `set rd ${pattern.right}\n`
      : (this.visitExpression(pattern.right, context) + `set rd ra\n`);

    const left = typeof pattern.left === 'number' ? `set rb ${pattern.left}\n`
      : (this.visitExpression(pattern.left, context) + `set rb ra\n`);

    const ifCode = `${right}\n${left}\nset ra 1\n${pattern.op} rb rd\n  set ra 0\n`;
    code += ifCode + 'set rc 0\nwhilen ra 1 {\n' + indent('state pushc\n', 1);
    const block = ws.getStatement();
    if (block.isKind(SyntaxKind.Block)) {
      const stmts = block.getStatements();
      stmts.forEach(stmt => {
        code += this.visitStatement(stmt, context);
      });
    }
    code += indent(ifCode + 'state popc\nadd rc 1\n', 1);
    code += '}\n';

    context.isInLoop = false;

    context.usingRD = useRD;

    if(useRD)
      code += `state popd\n`;

    return code;
  }

  /******************************************************************************
   * variable statements => local var
   *****************************************************************************/
  private visitVariableStatement(node: VariableStatement, context: CompilerContext): string {
    let code = '';
    if (!(context.currentFile.options & ECompileOptions.no_compile))
      code = this.options.lineDetail ? `/*${node.getText()}*/\n` : '';

    const decls = node.getDeclarationList().getDeclarations();
    for (const d of decls) {
      code += this.visitVariableDeclaration(d, context);
    }
    return code;
  }

  private visitVariableDeclaration(decl: VariableDeclaration, context: CompilerContext): string {
    const varName = decl.getName();
    let code = "";

    const type = decl.getType();

    if (type && type.getAliasSymbol() && type.getAliasSymbol().getName() == 'CON_NATIVE_GAMEVAR') {
      context.symbolTable.set(varName, {
        name: varName, type: ESymbolType.native, offset: 0, size: 1, CON_code: type.getAliasTypeArguments()[0].getText().replace(/[`'"]/g, "")
      });
      return code;
    }

    if (type && type.getAliasSymbol() && type.getAliasSymbol().getName() == 'CON_CONSTANT') {
      context.symbolTable.set(varName, {
        name: varName,
        type: ESymbolType.number | ESymbolType.constant,
        offset: 0,
        size: 1,
        literal: type.getAliasTypeArguments()[0].getLiteralValue() as number
      });
      return code;
    }

    if (type && type.getAliasSymbol()
      && (type.getAliasSymbol().getName() == 'CON_FUNC_ALIAS'
      || type.getAliasSymbol().getName() == 'CON_PROPERTY_ALIAS'))
      return code;

    if (type && type.getAliasSymbol() && type.getAliasSymbol().getName() == 'CON_NATIVE_OBJECT') {
      const alias = this.getObjectTypeLayout(type.getAliasTypeArguments()[0].getText().replace(/[`'"]/g, ""), context);
      if (!alias) {
        addDiagnostic(decl, context, 'error', `Undeclared type object ${type.getAliasTypeArguments()[0].getText()}`);
        return '';
      }

      context.symbolTable.set(varName, {
        name: varName, type: ESymbolType.native, offset: 0, size: 1, children: alias
      });
      return code;
    }

    const init = decl.getInitializer();
    if (init && init.isKind(SyntaxKind.ObjectLiteralExpression)) {
      code += this.visitObjectLiteral(init as ObjectLiteralExpression, context);

      if (context.currentFile.options & ECompileOptions.no_compile)
        return code;

      context.localVarCount++;
      // Store in symbol table that varName is an object.
      //const aliasName = this.getTypeAliasNameForObjectLiteral(init as ObjectLiteralExpression);
      //const size = aliasName ? this.getObjectSize(aliasName, context) : 0;

      //context.symbolTable.set(varName, { name: varName, type: "object", offset: 0, size: size });
    } else {
      if (context.currentFile.options & ECompileOptions.no_compile)
        return code;
      // Process non-object initializers as before.
      //const localVars = context.localVarCount;
      if (init)
        code += this.visitExpression(init as Expression, context);
      //if(!context.stringExpr || (context.stringExpr && context.arrayExpr))
      code += `add rsp 1\nsetarray flat[rsp] ra\n`;
      context.symbolTable.set(varName, {
        name: varName, type: context.curExpr,
        offset: context.localVarCount, size: 1,
        native_pointer: context.localVarNativePointer,
        native_pointer_index: context.localVarNativePointerIndexed,
        children: context.curSymRet ? context.curSymRet.children : undefined
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
  private visitExpressionStatement(stmt: ExpressionStatement, context: CompilerContext): string {
    return this.visitExpression(stmt.getExpression(), context);
  }

  /******************************************************************************
   * return => evaluate => set rb ra
   *****************************************************************************/
  private visitReturnStatement(rs: ReturnStatement, context: CompilerContext): string {
    let code = "";
    const expr = rs.getExpression();
    if (expr) {
      code += this.visitExpression(expr, context, 'rb');
    } else {
      code += `set rb 0\n`;
    }

    if (context.mainBFunc) {
      code += `sub rbp 1\nset rsp rbp\nset rssp rsbp\nstate pop\nset rsbp ra\nstate pop\nset rbp ra\n`;
      code += `break\n`
    } else {
      code += `sub rbp 1\nset rsp rbp\n\nstate pop\nset rbp ra\n`;
      code += `terminate\n`;
      context.curFunc.returns |= context.curExpr;
    }

    code += `// end function\n`;
    return code;
  }

  /******************************************************************************
   * if => must be (A && B), (A || B), or !(A || B)
   *****************************************************************************/
  private visitIfStatement(is: IfStatement, context: CompilerContext): string {
    let code = this.options.lineDetail ? `/*${is.getText()}*/\n` : '';
    const pattern = this.parseIfCondition(is.getExpression(), context);
    const thenPart = this.visitBlockOrStmt(is.getThenStatement(), context);
    const elsePart = is.getElseStatement() ? this.visitBlockOrStmt(is.getElseStatement()!, context) : "";

    if (!pattern) {
      code += `// invalid if condition fallback\nset rd 0\nset ra 1\nifand rd ra {\n${indent(thenPart, 1)}\n} else {\n${indent(elsePart, 1)}\n}\n`;
      return code;
    }

    const useRD = context.usingRD;
    context.usingRD = true;

    // Evaluate left side normally
    code += this.options.lineDetail ? `// 'if' left side\n` : '';
    code += this.visitExpression(pattern.left, context, 'rd');
    if(useRD)
      code += `state pushd\n`;

    // For the right side, check if it's a number or an Expression.
    code += this.options.lineDetail ? `// 'if' right side\n` : '';
    if (typeof pattern.right === "number") {
      code += `set ra ${pattern.right}\n`;
    } else {
      code += this.visitExpression(pattern.right, context);
    }

    if(useRD)
      code += `state popd\n`

    code += `${pattern.op} rd ra {\n`;
    code += indent(thenPart, 1);
    if (elsePart != '') {
      code += `} else {\n`;
      code += indent(elsePart, 1);
    }

    code += `}\n`;

    context.usingRD = useRD;

    return code;
  }

  // Switches are turned into IF conditions
  private visitSwitchStatement(sw: SwitchStatement, context: CompilerContext) {
    let code = (this.options.lineDetail ? `/*${sw.getText()}*/\n` : '') + this.visitExpression(sw.getExpression(), context);
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
    code += indent(`state pushb\n`, 1);
    for (let i = 0; i < cases.length; i++) {
      code += indent(`add rswc 1\n`, 1);
      const c = cases[i];
      if (c.isKind(SyntaxKind.DefaultClause))
        code += (this.options.lineDetail ? `/*${c.getText()}*/\n` : '') + indent(`ifge rswc ${cases.length} {\n`, 1);
      else {
        const clause = c.getExpression();
        
        code += this.options.lineDetail ? `/*${c.getText()}*/\n` : '';/* + indent(`state pushd\nstate pushc\n`, 1)*/
        code += indent(this.visitExpression(clause, context), 1);
        code += indent(`ife ra rsw {\n`, 1);
      }

      c.getStatements().forEach(e => code += indent(this.visitStatement(e, context), 2));
      code += `}\n`;
    }

    code += `}\ngetcurraddress rb\nife rswc -1 {\n  set rswc 0\n  jump ra\n}\nelse\n  state popb\n`;

    if(pastSwitch)
      code += `state popd\nset rswc rd\nstate popd\nset rsw rd\n`;
    else
      context.inSwitch = false;

    if(context.usingRD)
      code += `state popd\n`;

    return code;
  }

  private visitBlockOrStmt(s: Statement, context: CompilerContext): string {
    if (s.isKind(SyntaxKind.Block)) {
      const blk = s as Block;
      return blk.getStatements().map(st => this.visitStatement(st, context)).join("\n");
    }
    return this.visitStatement(s, context);
  }

  private parseIfCondition(expr: Expression, context: CompilerContext): IfCondition | undefined {
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

    if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
      const pExpr = expr as PropertyAccessExpression;
      return { op: "ifge", left: pExpr, right: 1 };
    }

    if (expr.isKind(SyntaxKind.Identifier)) {
      return { op: "ifge", left: expr as Identifier, right: 1 };
    }

    if (expr.isKind(SyntaxKind.CallExpression)) {
      const callExpr = expr as CallExpression;
      //if (nativeFn && nativeFn.returns && nativeFn.return_type === "variable") {
      // Instead of fabricating a fake Expression, simply return 1 as the expected boolean value.
      return { op: "ifg", left: callExpr, right: 0 };
      /*} else {
        addDiagnostic(expr, context, "error", `Native function call ${fnName} not allowed or not returning a boolean value`);
        return undefined;
      }*/
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

        //if (sub.isKind(SyntaxKind.CallExpression)) {
        //const callExpr = sub as CallExpression;;
        //if (nativeFn && nativeFn.returns && nativeFn.return_type === "variable") {
        // Instead of fabricating a fake Expression, simply return 1 as the expected boolean value.
        return { op: "ifle", left: sub, right: 0 };
        /*} else {
          addDiagnostic(expr, context, "error", `Native function call ${fnName} not allowed or not returning a boolean value`);
          return undefined;
        }*/
        //}
        //addDiagnostic(expr, context, "error", `if condition must be in the form !(A || B). Found something else.`);
        //return undefined;
      }
    }

    addDiagnostic(expr, context, "error", `Unrecognized if condition. Must be (A&&B), (A||B), a comparison, or a function call.`);
    return undefined;
  }


  /******************************************************************************
   * Expression
   *****************************************************************************/
  private visitExpression(expr: Expression, context: CompilerContext, reg = 'ra'): string {
    let code = ''//`/* ${expr.getText()} */\n`;
    context.curExpr = ESymbolType.number;
    context.curSymRet = null;

    switch (expr.getKind()) {
      case SyntaxKind.BinaryExpression:
        return code + this.visitBinaryExpression(expr as BinaryExpression, context, reg);

      case SyntaxKind.CallExpression:
        return code + this.visitCallExpression(expr as CallExpression, context, reg);

      case SyntaxKind.ObjectLiteralExpression:
        return code + this.visitObjectLiteral(expr as ObjectLiteralExpression, context);

      case SyntaxKind.PropertyAccessExpression:
      case SyntaxKind.ElementAccessExpression:
        return code + this.visitMemberExpression(expr, context, undefined, false, reg);

      case SyntaxKind.PrefixUnaryExpression:
      case SyntaxKind.PostfixUnaryExpression:
        return code + this.visitUnaryExpression(expr, context, reg);

      case SyntaxKind.ParenthesizedExpression:
        return code + this.visitParenthesizedExpression(expr as ParenthesizedExpression, context, reg);

      case SyntaxKind.ArrowFunction:
        return code + this.visitArrowFunctionExpression(expr as ArrowFunction, context);

      default:
        return code + this.visitLeafOrLiteral(expr, context, undefined, reg);
    }
  }

  private visitLeafOrLiteral(expr: Expression, context: CompilerContext, direct?: boolean, reg = 'ra'): string {
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
        if(off.type & ESymbolType.constant) {
          if(direct)
            return String(off.literal);

          return code + `set ${reg} ${off.literal}`;
        }

        if(off.type == ESymbolType.pointer) {
          if(direct)
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

        if (off.heap)
          code += `set rf 1\n`;

        if(direct)
          return String(off.literal);

        return code;
      }

      const native = findNativeVar_Sprite(name);

      if(native) {
        if(native.var_type == CON_NATIVE_TYPE.variable) {
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
      if(direct)
        return expr.getText()
      ;
      return code;
    }
    if (expr.isKind(SyntaxKind.StringLiteral) || expr.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
      let text = expr.getText().replace(/[`'"]/g, "");
      code += `state pushr2\nset r0 ${text.length + 1}\nset r1 ${EHeapType.string}\nstate alloc\nstate popr2\nsetarray flat[rb] ${text.length}\nset ri rb\n`;
      //code += `add rsp 1\nset rd rsp\nadd rsp 1\nsetarray flat[rsp] ${text.length}\n`;
      for (let i = 0; i < text.length; i++)
        code += `add ri 1\nsetarray flat[ri] ${text.charCodeAt(i)}\n`;

      if(reg != 'rb')
        code += `set ${reg} rb\n`;
      context.curExpr = ESymbolType.string;
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
        return code;
      }

      args.forEach((a) => {
        code += this.visitExpression(a as Expression, context);
      });

      return code + `state pushr2\nset r0 ra\nset r1 ${EHeapType.array}\nstate alloc\nstate popr2\n${reg != 'rb' ? `set ${reg} rb\n` : ''}`;
    }

    if (expr.isKind(SyntaxKind.AsExpression)) {
      code += this.visitExpression(expr.getExpression(), context);

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
        code += this.visitExpression(a as Expression, context);
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

  private visitBinaryExpression(bin: BinaryExpression, context: CompilerContext, reg = 'ra'): string {
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

    const useRD = context.usingRD;
    context.usingRD = true;

    if(useRD)
      code += `state pushd\n`;

    if (opText.includes("=") && !['>=', '<='].includes(opText)) {
      // assignment
      code += this.visitExpression(right, context, 'rd');

      if (opText != '=') {
        //code += `set rd ra\n`
        code += this.visitExpression(left, context);
        switch (opText) {
          case '+=':
            code += `add rd ra\n`;
            break;
          case "-=":
            code += `sub rd ra\n`;
            break;
          case "*=":
            code += `mul rd ra\n`;
            break;
          case "/=":
            code += `div rd ra\n`;
            break;
          case "%=":
            code += `mod rd ra\n`;
            break;
          case "&=":
            code += `and rd ra\n`;
            break;
          case "|=":
            code += `or rd ra\n`;
            break;
          case "^=":
            code += `xor rd ra\n`;
            break;
          case ">>=":
            code += `shiftr rd ra\n`;
            break;
          case "<<=":
            code += `shiftl rd ra\n`;
            break;
        }
      }

      code += this.storeLeftSideOfAssignment(left, context, 'rd');
      context.usingRD = useRD;
      if(useRD)
        code += `state popd\n`;
      
      return code;
    }

    code += `// left side\n`
    code += this.visitExpression(left, context, 'rd');
    const isQuote = Boolean(context.curExpr & ESymbolType.quote);
    const isString = Boolean(context.curExpr & ESymbolType.string);

    if (isQuote && opText != '+') {
      addDiagnostic(bin, context, "error", `Unhandled operator for string expression "${opText}"`);
      code += `set ra 0\n`;
    }

    //code += `set rd ra\n`;
    code += this.options.lineDetail ? `// right side\n` : '';
    code += this.visitExpression(right, context);

    if (isQuote && !(context.curExpr & ESymbolType.quote))
      code += `qputs 1022 %d\nqsprintf 1023 1022 ra\nset ra 1022\n`;

    if (isString && !(context.curExpr & ESymbolType.string))
      code += `state pushr1\nset r0 ra\nstate _convertInt2String\nstate popr1\nset ra rb\n`

    context.curExpr = isQuote ? ESymbolType.quote : ESymbolType.number;
    context.curExpr = isString ? ESymbolType.string : ESymbolType.number;

    switch (opText) {
      case "+":
        if (isQuote)
          code += `qstrcat rd ra\n`;
        else if (isString)
          code += `state pushr2\nset r0 rd\nset r1 ra\nstate _stringConcat\nstate popr2\nset ra rb\n`;
        else
          code += `add rd ra\n`;
        break;
      case "-":
        code += `sub rd ra\n`;
        break;
      case "*":
        code += `mul rd ra\n`;
        break;
      case "/":
        code += `div rd ra\n`;
        break;
      case "%":
        code += `mod rd ra\n`;
        break;
      case "&":
        code += `and rd ra\n`;
        break;
      case "|":
        code += `or rd ra\n`;
        break;
      case "^":
        code += `xor rd ra\n`;
        break;
      case ">>":
        code += `shiftr rd ra\n`;
        break;
      case "<<":
        code += `shiftl rd ra\n`;
        break;
      case "<":
        code += `set rb 0\nifl rd ra\n  set rb 1\n`;
        break;
      case "<=":
        code += `set rb 0\nifle rd ra\n  set rb 1\n`;
        break;
      case ">":
        code += `set rb 0\nifg rd ra\n  set rb 1\n`;
        break;
      case ">=":
        code += `set rb 0\nifge rd ra\n  set rb 1\n`;
        break;
      case "==":
        code += `set rb 0\nife rd ra\n  set rb 1\n`;
        break;
      case "!=":
        code += `set rb 0\nifn rd ra\n  set rb 1\n`;
        break;
      case "&&":
        code += `set rb 0\nifand rd ra\n  set rb 1\n`;
        break;
      case "||":
        code += `set rb 0\nifeither rd ra\n  set rb 1\n`;
        break;
      default:
        addDiagnostic(bin, context, "error", `Unhandled operator "${opText}"`);
        code += `set ra 0\n`;
    }

    switch(opText) {
      case "+":
      case "-":
      case "*":
      case "/":
      case "%":
      case "&":
      case "|":
      case "^":
        if(reg != 'rd')
          code += `set ${reg} rd\n`;
        break;
      
      default:
        if(reg != 'rb')
          code += `set ${reg} rb\n`;
        break;
    }

    context.usingRD = useRD;

    if(useRD)
      code += `state popd\n`;

    return code;
  }

  private storeLeftSideOfAssignment(left: Expression, context: CompilerContext, reg = 'ra'): string {
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
      code += `set ra ${reg}\n` + this.visitMemberExpression(left, context, true, false);
      return code;
    }

    addDiagnostic(left, context, "error", `Unsupported left side: ${left.getText()}`);
    code += `set ${reg} 0\n`;
    return code;
  }

  private resolveNativeArgument(arg: Expression, expected: number, context: CompilerContext): string {
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

      if(arg.isKind(SyntaxKind.NullKeyword))
        return '0';

      if(arg.isKind(SyntaxKind.Identifier)) {
        const vName = (arg as Identifier).getText();

        const sym = context.symbolTable.get(vName);

        if(!sym) {
          addDiagnostic(arg, context, 'error', `Variable ${vName} not declared`);
          return '';
        }

        if(!(sym.type & ESymbolType.pointer) && !(sym.type & ESymbolType.constant)) {
          addDiagnostic(arg, context, 'error', `Variable ${vName} is not a pointer/label type`);
          return '';
        }

        return sym.name;
      }

      if(arg.isKind(SyntaxKind.PropertyAccessExpression)) {
        const segments = this.unrollMemberExpression(arg);

        const obj = segments[0] as SegmentIdentifier;

        if(obj.name != 'this') {
          addDiagnostic(arg, context, 'error', `Action/Move/AI label/pointer cannot be outside of a class property declaration`);
        }

        let sym = context.symbolTable.get((segments[1] as SegmentIdentifier).name);

        if(!sym) {
          addDiagnostic(arg, context, 'error', `Variable ${(segments[1] as SegmentIdentifier).name} not declared`);
          return '';
        }

        for(let i = 1; i < segments.length; i++) {
          const seg = segments[i];
          if(seg.kind != 'property') {
              addDiagnostic(arg, context, 'error', `Segment ${seg.kind} is not allowed for pointer/label type`);
              return '';
          }

          if(sym.type & ESymbolType.object) {
            if(!sym.children) {
              addDiagnostic(arg, context, 'error', `Object ${sym.name} has no defined properties`);
              return '';
            }

            if(i == segments.length - 1) {
              addDiagnostic(arg, context, 'error', `Variable ${(segments[1] as SegmentIdentifier).name} is not a pointer/label type`);
              return '';
            }

            if(segments[i + 1].kind != 'property') {
              addDiagnostic(arg, context, 'error', `Segment ${segments[i + 1].kind} is not allowed for pointer/label type`);
              return '';
          }

            if(!sym.children[(segments[i + 1] as SegmentProperty).name]) {
              addDiagnostic(arg, context, 'error', `Property ${(segments[i + 1] as SegmentProperty).name} does not exist in ${sym.name} in ${arg.getText()}`);
              return '';
            }

            sym = sym.children[(segments[i + 1] as SegmentProperty).name] as SymbolDefinition;
            continue;
          }

          if(sym.type != (ESymbolType.pointer | ESymbolType.constant)) {
            addDiagnostic(arg, context, 'error', `Variable ${sym.name} is not a pointer/label type`);
            return '';
          }
        }

        return sym.name;
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

      if(arg.isKind(SyntaxKind.PrefixUnaryExpression)) {
        const exp = arg.getOperand();
        const op = arg.getOperatorToken();

        if(!exp.isKind(SyntaxKind.NumericLiteral)) {
          addDiagnostic(arg, context, "error", `Expected a numeric constant for a native CONSTANT argument. Received: ${arg.getKindName()}`);
          return '';
        }

        if(op == SyntaxKind.MinusToken) {
          return `-${exp.getLiteralValue()}`;
        }
      }

      addDiagnostic(arg, context, "error", `Expected a numeric constant for a native CONSTANT argument. Received: ${arg.getKindName()}`);
      return "";
    }
    // For VARIABLE arguments, we assume that the value is loaded into a register already.
    return "";
  }


  private visitCallExpression(call: CallExpression, context: CompilerContext, reg = 'ra'): string {
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
              code += this.visitExpression(args[i] as Expression, context, `r${i}`);
              //code += `set r${i} ra\n`;
              resolvedLiterals.push(null);
            }

            if (isClass)
              code += `set r${totalArgs - 1} flat[rbp]\n`;

            code += `state ${o.name}\nset ra rb\n`;
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
              code += this.visitExpression(args[i] as Expression, context, `r${i}`);
              //code += `set r${i} ra\n`;
              resolvedLiterals.push(null);
            }

            if (isClass)
              code += `set ri rbp\nadd ri ${objSym.offset}\nset r${totalArgs - 1} flat[ri]\n`;

            code += `state ${o.name}\n${reg != 'rb' ? `set ${reg} rb\n` :  ''}`;
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

    if(fnNameRaw == 'Stop' && fnObj == 'this') {
      if(context.hasLocalVars)
        code += `sub rbp 1\nset rsp rbp\n\nstate pop\nset rbp ra\n`
      else if(context.mainBFunc)
        code += `sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\n`
      code += `break\n`
      return code;
    }

    if (fnNameRaw == 'Quote' && !fnObj) {
      if (args[0].isKind(SyntaxKind.StringLiteral)) {
        let text = args[0].getText().replace(/[`'"]/g, "");
        if (text.length > 128) {
          addDiagnostic(args[0], context, 'warning', `Quote length greater than 128, truncating...`);
          text = text.slice(0, 128);
        }
        code += `add rssp 1\nqputs 1023 ${text}\nqstrcpy rssp 1023\nset ra rssp\n`;
        return code;
      } else {
        code += this.visitExpression(args[0] as Expression, context);
        code += `state pushr1\nset r0 ra\nstate _convertString2Quote\nstate popr1\n${reg != 'rb' ? `set ${reg} rb\n` :  ''}`
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

      if (nativeFn.type_belong)
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

      let fnType = 0; //0 - string, 1 - arrow, 2 - string from array, 3 - arrow from array

      for (let i = 0, j = 0; i < args.length; i++, j++) {
        const expected = nativeFn.arguments[i] ?? 0;
        // For LABEL and CONSTANT types, resolve to a literal.
        if (expected & (CON_NATIVE_FLAGS.LABEL | CON_NATIVE_FLAGS.CONSTANT) && !(expected & CON_NATIVE_FLAGS.OBJECT)) {
          const literal = this.resolveNativeArgument(args[i] as Expression, expected, context);
          resolvedLiterals.push(literal);
          // We do not emit register loads for these.
        } else if (expected & CON_NATIVE_FLAGS.STRING) {
          code += this.visitExpression(args[i] as Expression, context);
          if (!(context.curExpr & ESymbolType.string))
            code += `state pushr1\nset r0 ra\nstate _convertInt2String\nstate popr1\nset ra rb\n`

          code += `state pushr1\nset r0 ra\nstate _convertString2Quote\nstate popr1\nset r${j} rb\n`
          //code += `set r${j} ra\n`;
          resolvedLiterals.push(null);
        } else if (expected & CON_NATIVE_FLAGS.VARIABLE) {
          // For VARIABLE, generate code normally.
          code += this.visitExpression(args[i] as Expression, context, `r${i}`);
          //code += `set r${j} ra\n`;
          resolvedLiterals.push(null);
        } else if (expected & CON_NATIVE_FLAGS.FUNCTION) {
          // For FUNCTION, generate code normally and keep it at argCode
          argCode += this.visitExpression(args[i] as Expression, context);
          resolvedLiterals.push(null);
        } else if (expected & (CON_NATIVE_FLAGS.OBJECT | CON_NATIVE_FLAGS.ARRAY)) {
          // For OBJECT and ARRAY, the next register sets what type of address we are dealing with
          code += `set rf 0\n`;
          code += this.visitExpression(args[i] as Expression, context, `r${i}`);
          //code += `set r${j} ra\n`;
          j++;
          code += `set r${j} 0\nife rf 1\n set r${j} 1\n`
          resolvedLiterals.push(null);
        } else {
          code += this.visitExpression(args[i] as Expression, context, `r${i}`);
          //code += `set r${j} ra\n`;
          resolvedLiterals.push(null);
        }
      }

      if (nativeFn.type_belong) {
        code += `set ri rbp\nadd ri ${variable.offset}\nset r${argsLen - 1} flat[ri]\n`;
        if (nativeFn.type_belong.includes('string') && nativeFn.return_type == 'string')
          context.curExpr = ESymbolType.string;
      }

      if (nativeFn.return_type == 'array')
        context.curExpr |= ESymbolType.array;

      if (nativeFn.return_type == 'object')
        context.curExpr |= ESymbolType.object;

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
        const fnCode = (nativeFn.code as (args?: boolean, fn?: string) => string)(args.length > 0, argCode);
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
    } else {
      const fnName = fnNameRaw.startsWith("this.") ? fnNameRaw.substring(5) : fnNameRaw;
      const func = context.symbolTable.get(fnObj ? fnObj : fnName) as SymbolDefinition;

      if (!func) {
        addDiagnostic(call, context, 'error', `Invalid ${fnObj ? 'class/object' : 'function'} ${fnNameRaw}`);
        return '';
      }

      const isClass = Boolean(func.type & ESymbolType.class);
      const totalArgs = args.length + (isClass ? 1 : 0);

      if (isClass && (!func.children || (func.children && !func.children[fnName]))) {
        addDiagnostic(call, context, 'error', `Undefined method ${fnName} in class ${func.name}`)
        return '';
      }

      // If not native, assume it's a user function state
      if (totalArgs > 0) {
        code += `state pushr${totalArgs > 12 ? 'all' : totalArgs}\n`;
        context.localVarCount += totalArgs;
      }

      for (let i = 0; i < args.length; i++) {
        code += this.visitExpression(args[i] as Expression, context, `r${i}`);
        //code += `set r${i} ra\n`;
        resolvedLiterals.push(null);
      }

      if (isClass)
        code += `set ri rbp\nadd ri ${func.offset}\nset r${totalArgs - 1} flat[ri]\n`;

      code += `state ${isClass ? func.children[fnName].name : (func.CON_code ? func.CON_code : func.name)}\n${reg != 'rb' ? `set ${reg} rb\n` :  ''}`;
      if (totalArgs > 0) {
        code += `state popr${totalArgs > 12 ? 'all' : totalArgs}\n`;
        context.localVarCount -= totalArgs;
      }

      context.curExpr = isClass ? (func.children[fnName] as SymbolDefinition).returns : func.returns;
    }

    if (nativeFn && nativeFn.returns) {
      code += `${reg != 'rb' ? `set ${reg} rb\n` :  ''}`;
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

  private processObjectLiteral(objLit: ObjectLiteralExpression, context: CompilerContext): { code: string, layout: { [key: string]: SymbolDefinition }, size: number } {
    let code = this.options.lineDetail ? `/* Object literal: ${objLit.getText()} */\n` : '';

    // Reserve one slot for the object's base pointer.
    code += `add rsp 1\nset ri rsp\nadd ri 1\nsetarray flat[rsp] ri\n`;
    // The object's base pointer is now stored at flat[rsp].

    //We will store the code for nested objects and arrays here
    //After definining all the root properties, then we add the instance code
    let instanceCode = '';

    /*
      Any object, literal or typed, will follow this structure example:
        [0x00000400] Object address: 0x00000401
        [0x00000401]  - Property 0 (integer) value = 0
        [0x00000402]  - Property 1 (stack array with 3 elements) address = 0x00000404
        [0x00000403]  - Property 2 (stack object with 2 properties) address = 0x00000408

        [0x00000404]    - Property 1 length = 3
        [0x00000405]    - Property 1 element 0 = 0
        [0x00000406]    - Property 1 element 1 = 5
        [0x00000407]    - Property 1 element 2 = 90

        [0x00000408]    - Property 2 property 0 (integer) value = 3
        [0x00000409]    - Property 2 property 1 (integer) value = 7

        So the contents of objects/arrays will come after the properties
    */

    // Build the layout as a plain object.
    let layout: { [key: string]: SymbolDefinition } = {};
    let totalSlots = 0; // count of property slots allocated

    let curTotalSize = 0;

    const aliasName = this.getTypeAliasNameForObjectLiteral(objLit);
    if (aliasName && context.typeAliases.has(aliasName)) {
      const typeDef = context.typeAliases.get(aliasName)!;
      // Process each expected property (in declared order from the type alias).
      const totalProps = Object.keys(typeDef.members).length;
      curTotalSize = totalProps;
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
            curTotalSize++;
            code += `add rsp 1\nset ri rsp\nadd ri ${curTotalSize - totalSlots}\nsetarray flat[rsp] ri\n`
            // For an array property (e.g., low: wow[])
            const baseType = propType.slice(0, -2).trim();
            const initText = pa.getInitializerOrThrow().getText();
            const count = this.getArraySize(initText);
            const instanceSize = this.getObjectSize(baseType, context);
            const instanceType = context.typeAliases.get(baseType);
            instanceCode += `add rsp 1\nsetarray flat[rsp] ${count}\n`;
            if (instanceType) {
              const result = this.getObjectTypeLayout(baseType, context);
              for (let j = 0; j < count; j++) {
                for (let k = 0; k < instanceSize; k++) {
                  instanceCode += `set ra 0\nadd rsp 1\nsetarray flat[rsp] ra\n`;
                  curTotalSize++;
                }
              }

              layout[propName] = {
                name: propName,
                type: ESymbolType.object | ESymbolType.array,
                offset: totalSlots,
                size: count * instanceSize,
                num_elements: count,
                children: { ...result }  // clone children as plain object
              };
            } else {
              // For each element, allocate instanceSize slots.
              for (let j = 0; j < count; j++) {
                for (let k = 0; k < instanceSize; k++) {
                  instanceCode += `set ra 0\nadd rsp 1\nsetarray flat[rsp] ra\n`;
                  curTotalSize++;
                }
              }
              layout[propName] = {
                name: propName,
                type: ESymbolType.array,
                offset: totalSlots,
                size: count * instanceSize,
                num_elements: count,
              };
            }
          } else if (context.typeAliases.has(propType)) {
            curTotalSize++;
            code += `add rsp 1\nset ri rsp\nadd ri ${curTotalSize - totalSlots}\nsetarray flat[rsp] ri\n`
            // For a nested object property.
            const result = this.processObjectLiteral(pa.getInitializerOrThrow() as ObjectLiteralExpression, context);
            instanceCode += result.code;
            const nestedSize = result.size;
            curTotalSize += result.size;
            layout[propName] = {
              name: propName,
              type: ESymbolType.object,
              offset: totalSlots,
              size: nestedSize,
              children: { ...result.layout }  // clone children as plain object
            };
          } else {
            // For a primitive property.
            const init = pa.getInitializerOrThrow();
            code += this.visitExpression(init, context);
            code += `add rsp 1\nsetarray flat[rsp] ra\n`;
            layout[propName] = {
              name: propName,
              type: ESymbolType.number,
              offset: totalSlots,
              size: 1,
              literal: init.isKind(SyntaxKind.NumericLiteral)
                ? (init as NumericLiteral).getLiteralValue()
                : undefined
            };
          }
        } else {
          // Property not provided: default to 0.
          code += `set ra 0\nadd rsp 1\nsetarray flat[rsp] ra\n`;
          layout[propName] = { name: propName, type: ESymbolType.number, offset: totalSlots, size: 1 };
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
            curTotalSize++;
            code += `add rsp 1\nset ri rsp\nadd ri ${curTotalSize}\nsetarray flat[rsp] ri\n`
            const initText = init.getText();
            const count = this.getArraySize(initText);
            //const instanceSize = this.getObjectSize(baseType, context);
            // For each element, allocate instanceSize slots.
            instanceCode += `add rsp 1\nsetarray flat[rsp] ${count}\n`;
            for (let j = 0; j < count; j++) {
              instanceCode += `set ra 0\nadd rsp 1\nsetarray flat[rsp] ra\n`;
              curTotalSize++;
            }
            layout[propName] = {
              name: propName,
              type: ESymbolType.object | ESymbolType.array,
              offset: totalSlots,
              size: count,
              num_elements: count,
            };
          } else if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
            // For a nested object property.
            curTotalSize++;
            code += `add rsp 1\nset ri rsp\nadd ri ${curTotalSize - totalSlots}\nsetarray flat[rsp] ri\n`
            const result = this.processObjectLiteral(init, context);
            instanceCode += result.code;
            const nestedSize = result.size;
            curTotalSize += result.size;
            layout[p.getName()] = {
              name: propName,
              type: ESymbolType.object,
              offset: totalSlots,
              size: nestedSize,
              children: { ...result.layout }  // clone children as plain object
            };
          } else {
            // For a primitive property.
            code += this.visitExpression(init, context);
            code += `add rsp 1\nsetarray flat[rsp] ra\n`;
            layout[propName] = {
              name: propName,
              type: ESymbolType.number,
              offset: totalSlots,
              size: 1,
              literal: init.isKind(SyntaxKind.NumericLiteral)
                ? (init as NumericLiteral).getLiteralValue()
                : undefined
            };
          }
        } else
          addDiagnostic(objLit, context, "error", `No property assignmetn found during object declaration: ${objLit.getText()}`);
      }

    }

    // The object's base pointer is at: flat[rsp - (totalSlots + 1)]
    //code += `set ri rbp\nadd ri ${totalSlots + 1}\nset ra flat[ri]\n`;

    code += instanceCode;

    return { code, layout: layout, size: totalSlots };
  }


  private visitObjectLiteral(objLit: ObjectLiteralExpression, context: CompilerContext): string {
    const result = this.processObjectLiteral(objLit, context);
    // If the object literal is assigned to a variable, retrieve its name.
    const varName = this.getVarNameForObjectLiteral(objLit);
    if (varName) {
      // Store the layout in the global symbol table.
      context.symbolTable.set(varName, { name: varName, type: ESymbolType.object, offset: context.localVarCount + 1, size: result.size, children: result.layout });
    }
    if (context.currentFile.options & ECompileOptions.no_compile)
      return '';

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

  private visitMemberExpression(expr: Expression, context: CompilerContext, assignment?: boolean, direct?: boolean, reg = 'ra'): string {
    let code = this.options.lineDetail ? `/* ${expr.getText()} */\n` : '';
    const segments = this.unrollMemberExpression(expr);

    if (segments.length === 0) {
      addDiagnostic(expr, context, "warning", `No segments found for expression: ${expr.getText()}`);
      return `set ${reg} 0\n`;
    }

    // Handle the object
    const obj = segments[0] as SegmentIdentifier;
    let sym: SymbolDefinition | EnumDefinition | null = null;
    if (obj.kind == 'identifier' && ['sprites', 'sectors', 'walls', 'players', 'EMoveFlags'].indexOf(obj.name) == -1) {
      const eSym = context.symbolTable.get(obj.name);

      if (eSym && eSym.type == ESymbolType.enum) {
        const seg = segments[1] as SegmentProperty
        if (direct)
          return String(eSym.children[seg.name]);

        code = `set ${reg} ${eSym.children[seg.name]}\n`;
        return code;
      }

      sym = context.symbolTable.get(obj.name) as SymbolDefinition;
      if (!sym) {
        sym = context.paramMap[obj.name];

        if (!sym) {
          addDiagnostic(expr, context, "error", `Undefined object: ${expr.getText()}`);
          return "set ${reg} 0\n";
        }
      }

      if (sym.type & ESymbolType.string || sym.type & ESymbolType.array) {
        if ((segments[1].kind == 'property' && segments[1].name == 'length'))
          return code + `set ri rbp\nadd ri ${sym.offset}\nset ri flat[ri]\n${assignment ? `setarray flat[ri] ${reg}\n` : `set ${reg} flat[ri]`}\n`;
      }

      if (sym.type & ESymbolType.native) {
        //If got here, it must be a symbol only
        for (let i = 1; i < segments.length; i++) {
          const seg = segments[i];

          if (seg.kind == 'index') {
            addDiagnostic(expr, context, "error", `Native object array symbols not yet supported`);
            return "";
          }

          if (seg.kind == 'property') {
            if (!sym.children) {
              addDiagnostic(expr, context, "error", `Object ${sym.name} properties are not defined: ${expr.getText()}`);
              return "set ra 0\n";
            }

            if (!sym.children[seg.name]) {
              addDiagnostic(expr, context, "error", `Property ${seg.name} not found in: ${expr.getText()}`);
              return "set ra 0\n";
            }

            sym = sym.children[seg.name] as SymbolDefinition;
            continue;
          }
        }

        code += assignment ? `set ${sym.CON_code} ${reg}\n` : `set ${reg} ${sym.CON_code}\n`;
        return code;
      }

      if (!sym.native_pointer) {
        code += `set ri rbp\nadd ri ${sym.offset}\n`;
        code += `set ri flat[ri]\n`;

        for (let i = 1; i < segments.length; i++) {
          const seg = segments[i];
          if (seg.kind == 'index') {
            if (!(sym.type & ESymbolType.array) && !(sym.type & ESymbolType.object) && !(sym.type & ESymbolType.string)) {
              addDiagnostic(expr, context, "error", `Indexing a non array variable: ${expr.getText()} - ${sym.type}`);
              return "set ra 0\n";
            }

            const localVars = context.localVarCount;
            //code += `state pushd\n`
            if (assignment)
              code += `state push\n`;

            code += `state pushi\n`;
            code += this.visitExpression(seg.expr, context);
            if (localVars != context.localVarCount) {
              code += `sub rsp ${localVars - context.localVarCount - 1}\n`;
              context.localVarCount = localVars;
            }
            code += `state popi\n`;
            if (sym.type & (ESymbolType.object | ESymbolType.array))
              code += `mul ra ${(sym as SymbolDefinition).size / (sym as SymbolDefinition).num_elements}\nadd ri ra\nadd ri 1\nset ri flat[ri]\n`
            else
              code += `add ri ra\nadd ri 1\n`;

            if (sym.type & (ESymbolType.string | ESymbolType.array))
              context.curExpr = ESymbolType.string | ESymbolType.array;

            if (assignment)
              code += `state pop\n`;

            continue;
          }

          if (seg.kind == 'property') {
            if (seg.name == 'length' && sym.type & ESymbolType.array) {
              code += `set ri flat[ri]\n`;
              context.curExpr = ESymbolType.number;
              break;
            }

            if (!sym.children) {
              addDiagnostic(expr, context, "error", `Object property ${seg.name} is not defined: ${expr.getText()}`);
              return "set ra 0\n";
            }

            if (!sym.children[seg.name]) {
              addDiagnostic(expr, context, "error", `Property ${seg.name} not found in: ${expr.getText()}`);
              return "set ra 0\n";
            }

            sym = sym.children[seg.name] as SymbolDefinition | EnumDefinition;

            if (sym.type == ESymbolType.enum)
              return direct ? String(sym.children[(segments[i + 1] as SegmentProperty).name]) : (`set ${reg} ${sym.children[(segments[i + 1] as SegmentProperty).name]}\n`);

            if(sym.global) {
              if (sym.offset != 0)
                code += `set ri ${sym.offset}\n`;
              else
                code += `set ri 0\n`;
            } else if (sym.offset != 0)
              code += `add ri ${sym.offset}\n`;

            if (sym.type & ESymbolType.object || sym.type & ESymbolType.array)
              code += `set ri flat[ri]\n`;

            continue;
          }
        }

        if(assignment && sym.readonly) {
          addDiagnostic(expr, context, 'error', `Tried to assign to a read-only property ${sym.name} in ${expr.getText()}`);
          return '';
        }

        if (assignment)
          code += `setarray flat[ri] ${reg}\n`;
        else
          code += `set ${reg} flat[ri]\n`;

        if (direct)
          return String(sym.literal);

        if(sym.type & ESymbolType.constant)
          code = `set ${reg} ${sym.literal}\n`;

        return code;
      }
    }

    if (obj.kind == 'identifier' || obj.kind == 'this') {
      switch (obj.name) {
        case 'EMoveFlags':
          if (direct)
            return EMoveFlags[(segments[1] as SegmentProperty).name];

          code = `set ${reg} ${EMoveFlags[(segments[1] as SegmentProperty).name]}\n`;
          return code;

        default: //sprites, sectors, walls or other enums
          if (obj.kind != 'this') {
            //Check if it's a enum
            const e = context.symbolTable.get(obj.name);

            if (e && e.type == ESymbolType.enum) {
              const seg = segments[1] as SegmentProperty
              if (direct)
                return String(e.children[seg.name]);

              code += `set ${reg} ${e.children[seg.name]}\n`;
              return code;
            }

            if (segments[1].kind != 'index' && (sym && !(sym as SymbolDefinition).native_pointer_index)) {
              addDiagnostic(expr, context, "error", `Missing index for ${obj.name}: ${expr.getText()}`);
              return "set ra 0\n";
            }
            if (segments[1].kind == 'index') {
              if(assignment)
                code += `state push\n`;
              code += this.visitExpression(segments[1].expr, context);
              code += `set ri ra\n`;
              if(assignment)
                code += `state pop\n`;
            }
          } else {
            if (context.curClass)
              code += `set ri flat[rbp]\n`;

            if (context.currentActorPicnum)
              obj.name = 'sprites';
          }

          //Go no further, it just wants the reference
          if (segments.length == 2 && segments[1].kind == 'index') {
            context.localVarNativePointer = obj.name as any;
            context.localVarNativePointerIndexed = true,
              code += `set ${reg} ri\n`;
            return code;
          }

          sym = sym as SymbolDefinition;

          let seg = segments[obj.kind == 'this' || (sym && sym.native_pointer_index) ? 1 : 2] as SegmentProperty;
          let op = '';

          if (sym && sym.native_pointer) {
            obj.name = sym.native_pointer;

            if (sym.native_pointer_index)
              code += `set ri rbp\nadd ri ${sym.offset}\nset ri flat[ri]\n`;
          }

          if (seg.kind == 'property') {
            if (obj.kind == 'this' && (context.curClass || context.symbolTable.has(seg.name))) {
              if (context.curClass && context.curClass.num_elements == 0) {
                addDiagnostic(expr, context, 'error', `Class ${context.curClass.name} has no properties`);
                return '';
              }

              if (context.curClass && !Object.keys(context.curClass.children).find(e => e == seg.name)) {
                addDiagnostic(expr, context, 'error', `Undefined property ${seg.name} in class ${context.curClass.name}`);
                return '';
              }

              //Check if it's an action, move or ai
              let lastSeg = segments.at(-1), loc = false;;
              if(lastSeg.kind == 'property') {
                let proceed = true;

                if(lastSeg.name == 'loc') {
                  lastSeg = segments.at(-2);
                  if(lastSeg.kind != 'property')
                    proceed = false;
                  else loc = true;
                }

                if(proceed) {
                  //@ts-ignore
                  const pointer = context.currentActorLabels[lastSeg.name];

                  if(pointer && !(pointer.type & ESymbolType.enum) && (pointer.type & ESymbolType.pointer || loc)) {
                    context.curExpr = ESymbolType.pointer;
                    if(direct)
                      return String(pointer.literal);

                    return `set ${reg} ${pointer.literal}\n`;
                  }
                }
              }

              let pSym = (context.curClass
                ? context.curClass.children[seg.name]
                : context.symbolTable.get(seg.name)) as SymbolDefinition;

              if(pSym.global) {
                if (pSym.offset != 0)
                  code += `set ri ${pSym.offset}\n`;
                else 
                  code += `set ri 0\n`;
              } else if (pSym.offset != 0)
                code += `add ri ${pSym.offset}\n`;

              for (let i = 2; i < segments.length; i++) {
                const s = segments[i];

                if (s.kind == 'index') {
                  if (!(pSym.type & ESymbolType.array)) {
                    addDiagnostic(expr, context, 'error', `Indexing a non-array property ${pSym.name}`);
                    return '';
                  }

                  code += `set ri flat[ri]\n`;

                  const localVars = context.localVarCount;
                  //code += `state pushd\n`
                  if (assignment)
                    code += `state push\n`;
                  code += `state pushi\n`;
                  code += this.visitExpression(s.expr, context);
                  if (localVars != context.localVarCount) {
                    code += `sub rsp ${localVars - context.localVarCount - 1}\n`;
                    //code += `add rsp 1\n` //Account for the push rd we did back there
                    context.localVarCount = localVars;
                  }

                  code += `state popi\n`;

                  if (pSym.type == (ESymbolType.object | ESymbolType.array))
                    code += `mul ra ${pSym.size / pSym.num_elements}\nadd ri ra\nadd ri 1\n`
                  else
                    code += `add ri ra\nadd ri 1\n`;

                  if (pSym.type == (ESymbolType.string | ESymbolType.array))
                    context.curExpr = pSym.type;

                  if (assignment)
                    code += `state pop\n`;

                  continue;
                }

                if (s.name == 'length' && (pSym.type & ESymbolType.string || pSym.type & ESymbolType.array))
                  return code + (assignment ? `setarray flat[ri] ra\n` : `set ${reg} flat[ri]\n`);

                if (!Object.keys(pSym.children).find(e => e == s.name)) {
                  addDiagnostic(expr, context, 'error', `Undefined property ${s.name} in obj/class ${pSym.name} in ${expr.getText()}`);
                  return '';
                }

                code += `set ri flat[ri]\n`;

                pSym = pSym.children[s.name] as SymbolDefinition;

                if (pSym.offset != 0)
                  code += `add ri ${pSym.offset}\n`;
              }

              if(assignment && pSym.readonly) {
                addDiagnostic(expr, context, 'error', `Tried to assign to a read-only property ${pSym.name} in ${expr.getText()}`);
                return '';
              }

              if(direct)
                return String(pSym.literal);

              if(pSym.type & ESymbolType.constant)
                return `set ${reg} ${pSym.literal}\n`;

              return code + (assignment ? `setarray flat[ri] ${reg}\n` : `set ${reg} flat[ri]\n`);
            }

            code += `set ri THISACTOR\n`;

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

            //if (assignment)
              //code += `state push\n`;

            let pushes = 0;

            if (nVar.type == CON_NATIVE_FLAGS.OBJECT) {
              let v = nVar.object;

              for (let i = 3; i < segments.length; i++) {
                const s = segments[i];

                if (nVar.var_type == CON_NATIVE_TYPE.array) {
                  if (s.kind != 'index') {
                    addDiagnostic(expr, context, "error", `Missing index for ${seg.name}: ${expr.getText()}`);
                    return "set ra 0\n";
                  }

                  if(assignment) {
                    code += `state push\n`;
                    pushes++;
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
                    for(let i = 0; i < pushes; i++)
                      code += `state pop\n`;
                    if (!overriden)
                      code += `${assignment ? 'set' : 'get'}${op}[ri].`;

                    code += `${v.code} ${reg}\n`;
                  }

                  if (v.var_type == CON_NATIVE_TYPE.object)
                    nVar = v;
                }
              }
            } else if (nVar.type == CON_NATIVE_FLAGS.VARIABLE) {
              if (nVar.var_type == CON_NATIVE_TYPE.native) {
                if (!overriden)
                  code += `${assignment ? 'set' : 'get'}${op}[ri].`;

                code += `${nVar.code} ${reg}\n`;
              } else code += `set ${assignment ? (nVar.code + ` ${reg}\n`)
                : (`${reg} ` + nVar.code + '\n')}`
            }
          }

          return code;
      }
    }

    addDiagnostic(expr, context, "warning", `Unhandled member expression: ${expr.getText()}`);
    code += `set ra 0\n`;
    return code;
  }


  private visitUnaryExpression(expr: Expression, context: CompilerContext, reg = 'ra'): string {
    let code = this.options.lineDetail ? `// unary: ${expr.getText()}\n` : '';
    if (expr.isKind(SyntaxKind.PrefixUnaryExpression)) {
      const pre = expr as PrefixUnaryExpression;
      code += this.visitExpression(pre.getOperand(), context);
      switch (pre.getOperatorToken()) {
        case SyntaxKind.PlusPlusToken:
          code += `add ${reg} 1\n`;
          break;
        case SyntaxKind.MinusMinusToken:
          code += `sub ${reg} 1\n`;
          break;
        case SyntaxKind.MinusToken:
          code += `inv ${reg}\n`;
          break;
        case SyntaxKind.ExclamationToken:
          //addDiagnostic(expr, context, "error", `"!" not allowed in normal expressions (only if patterns)`);
          code += `set rb 0\nifge ${reg} 1\nset rb 1\n`;
          break;
        default:
          addDiagnostic(expr, context, "error", `Unhandled prefix op`);
          code += `set ra 0\n`;
      }
      code += `setarray flat[ri] ${reg}\n`;
      return code;
    } else if (expr.isKind(SyntaxKind.PostfixUnaryExpression)) {
      const post = expr as PostfixUnaryExpression;
      code += this.visitExpression(post.getOperand(), context);
      switch (post.getOperatorToken()) {
        case SyntaxKind.PlusPlusToken:
          code += `add ${reg} 1\n`;
          break;
        case SyntaxKind.MinusMinusToken:
          code += `sub ${reg} 1\n`;
          break;
        default:
          addDiagnostic(expr, context, "error", `Unhandled postfix op`);
          code += `set ra 0\n`;
      }
      code += `setarray flat[ri] ${reg}\n`;
      return code;
    }
    return code;
  }

  private visitParenthesizedExpression(expr: ParenthesizedExpression, context: CompilerContext, reg = 'ra'): string {
    return this.visitExpression(expr.getExpression(), context, reg);
  }

  /******************************************************************************
   * VISIT FUNCTION DECL
   * => state <functionName> { ... }
   ****************************************************************************/
  private visitFunctionDeclaration(fd: FunctionDeclaration, context: CompilerContext): string {
    const name = fd.getName() || "anonFn";
    // new local context
    const localCtx: CompilerContext = {
      ...context,
      localVarOffset: {},
      localVarCount: 0,
      paramMap: {},
      isInLoop: false,
      mainBFunc: false,
      curFunc: undefined,
    };

    let code = `${this.options.lineDetail ? `/*${fd.getText()}*/` : ''}\ndefstate ${localCtx.curModule ? `_${localCtx.curModule.name}_` : ''}${name}\n  set ra rbp \n  state push\n  set rbp rsp\n  add rbp 1\n`;
    fd.getParameters().forEach((p, i) => {
      const type = p.getType();
      let t: Exclude<ESymbolType, ESymbolType.enum> = ESymbolType.number;
      let children: Record<string, SymbolDefinition>;
      let con = '';
      switch (type.getText()) {
        case 'string':
        case 'pointer':
        case 'boolean':
          t = ESymbolType[type.getText()];
          break;

        case 'IAction':
        case 'IMove':
        case 'IAi':
          t = ESymbolType.object;
          children = type.getText() == 'IAction' ? {
            loc: { name: 'loc', offset: 0, type: ESymbolType.number },
            start: { name: 'start', offset: 0, type: ESymbolType.number },
            length: { name: 'length', offset: 0, type: ESymbolType.number },
            viewType: { name: 'viewType', offset: 0, type: ESymbolType.number },
            incValue: { name: 'incValue', offset: 0, type: ESymbolType.number },
            delay: { name: 'delay', offset: 0, type: ESymbolType.number },
          } : (type.getText() == 'IMove' ? {
            loc: { name: 'loc', offset: 0, type: ESymbolType.number },
            horizontal_vel: { name: 'horizontal_vel', offset: 0, type: ESymbolType.number },
            vertical_vel: { name: 'vertical_vel', offset: 0, type: ESymbolType.number },
          } : {
            loc: { name: 'loc', offset: 0, type: ESymbolType.number },
            action: { name: 'action', offset: 0, type: ESymbolType.number },
            move: { name: 'move', offset: 0, type: ESymbolType.number },
            flags: { name: 'flags', offset: 0, type: ESymbolType.number },
          });
          break;

        case 'constant':
        case 'number':
          break;

        case 'quote':
          t = ESymbolType.quote;
          break;

        case 'string[]':
          t = ESymbolType.string | ESymbolType.array;
          break;

        case 'number[]':
        case '[]':
        case 'any[]':
          t = ESymbolType.array;
          break;

        default:
          let tText = type.getText();

          if (type.getText().endsWith('[]')) {
            t = ESymbolType.object | ESymbolType.array;
            tText = tText.slice(0, tText.length - 2);
          } else t = ESymbolType.object;

          const alias = context.typeAliases.get(tText);

          if (!alias) {
            addDiagnostic(fd, context, 'error', `Undeclared type alias ${tText}`);
            return '';
          }

          children = this.getObjectTypeLayout(tText, context);
      }
      localCtx.paramMap[p.getName()] = { name: p.getName(), offset: i, type: t, children };
    });

    context.symbolTable.set(name, {
      name: `${localCtx.curModule ? `_${localCtx.curModule.name}_` : ''}${name}`,
      type: ESymbolType.function,
      offset: 0
    });

    localCtx.symbolTable.set(name, {
      name: `${localCtx.curModule ? `_${localCtx.curModule.name}_` : ''}${name}`,
      type: ESymbolType.function,
      offset: 0
    });

    localCtx.curFunc = localCtx.symbolTable.get(name) as SymbolDefinition;

    if (context.currentFile.options & ECompileOptions.state_decl) {
      const t = fd.getReturnType();
      if (t.getAliasSymbol().getName() == 'CON_NATIVE') {
        const args = t.getAliasTypeArguments();

        if (args.length > 0) {
          (localCtx.symbolTable.get(name) as SymbolDefinition).CON_code = (localCtx.symbolTable.get(name) as SymbolDefinition).name = args[0].getText().replace(/[`'"]/g, "");
          (context.symbolTable.get(name) as SymbolDefinition).CON_code = (context.symbolTable.get(name) as SymbolDefinition).name = args[0].getText().replace(/[`'"]/g, "");
        }
      }
    }

    const t = fd.getReturnType();

    if (t && t.getAliasSymbol() && t.getAliasSymbol().getName() == 'CON_NATIVE_STATE') {
      const args = t.getAliasTypeArguments();

      if (args.length > 0) {
        (localCtx.symbolTable.get(name) as SymbolDefinition).CON_code = (localCtx.symbolTable.get(name) as SymbolDefinition).name = args[0].getText().replace(/[`'"]/g, "");
        (context.symbolTable.get(name) as SymbolDefinition).CON_code = (context.symbolTable.get(name) as SymbolDefinition).name = args[0].getText().replace(/[`'"]/g, "");
      }
    }

    const body = fd.getBody() as Block;
    if (body) {
      const params = Object.keys(localCtx.paramMap).length;

      if (body.getDescendantsOfKind(SyntaxKind.ArrowFunction).length > 0) {
        if (params > 0) {
          code += indent(`state pushr${params > 12 ? 'all' : params}\n`, 1);
          Object.entries(localCtx.paramMap).forEach((e, i) => {
            localCtx.symbolTable.set(e[0], {
              ...e[1],
              offset: i
            });

            localCtx.localVarCount++;
          });
        }
      }

      body.getStatements().forEach(st => {
        code += indent(this.visitStatement(st, localCtx), 1) + "\n";
      });

      if (body.getDescendantsOfKind(SyntaxKind.ArrowFunction).length > 0) {
        if (params > 0) {
          code += indent(`state popr${params > 12 ? 'all' : params}\n`, 1);

          Object.entries(localCtx.paramMap).forEach((e, i) => {
            localCtx.symbolTable.delete(e[0]);
          });
        }
      }
    }

    context.symbolTable.set(name, localCtx.symbolTable.get(name));

    code += `  sub rbp 1\n  set rsp rbp\n  state pop\n  set rbp ra\nends \n\n`;
    return code;
  }

  /******************************************************************************
   * VISIT ARROW FUNCTION EXPRESSION
   * => state <functionName> { ... }
   ****************************************************************************/
  private visitArrowFunctionExpression(af: ArrowFunction, context: CompilerContext): string {
    // new local context
    const localCtx: CompilerContext = {
      ...context,
      localVarOffset: {},
      localVarCount: 0,
      paramMap: {},
      isInLoop: false,
      mainBFunc: false,
      curFunc: undefined,
      symbolTable: new Map(context.symbolTable)
    };

    let code = `${this.options.lineDetail ? `/*${af.getText()}*/` : ''}\nset ra rbp \nstate push\nset rbp rsp\nadd rbp 1\n`;
    af.getParameters().forEach((p, i) => {
      const type = p.getType();
      let t: Exclude<ESymbolType, ESymbolType.enum> = ESymbolType.number;
      let children: Record<string, SymbolDefinition>;
      let con = '';
      switch (type.getText()) {
        case 'string':
        case 'pointer':
        case 'boolean':
          t = ESymbolType[type.getText()];
          break;

        case 'constant':
        case 'number':
          break;

        case 'quote':
          t = ESymbolType.quote;
          break;

        case 'string[]':
          t = ESymbolType.string | ESymbolType.array;
          break;

        case 'number[]':
        case '[]':
        case 'any[]':
          t = ESymbolType.array;
          break;

        default:
          let tText = type.getText();

          if (type.getText().endsWith('[]')) {
            t = ESymbolType.object | ESymbolType.array;
            tText = tText.slice(0, tText.length - 2);
          } else t = ESymbolType.object;

          const alias = context.typeAliases.get(tText);

          if (!alias) {
            addDiagnostic(af, context, 'error', `Undeclared type alias ${tText}`);
            return '';
          }

          children = this.getObjectTypeLayout(tText, context);
      }
      localCtx.paramMap[p.getName()] = { name: p.getName(), offset: i, type: t, children };
    });

    const body = af.getBody() as any;
    if (body) {
      body.getStatements().forEach(st => {
        code += indent(this.visitStatement(st, localCtx), 1) + "\n";
      });
    }

    code += `sub rbp 1\nset rsp rbp\nstate pop\nset rbp ra\n\n`;
    return code;
  }

  /******************************************************************************
   * VISIT CLASS DECL => if extends CActor => parse constructor => skip code => gather actions
   ****************************************************************************/
  private visitClassDeclaration(cd: ClassDeclaration, context: CompilerContext): string {
    const className = cd.getName() || "AnonClass";
    let code = this.options.lineDetail ? `// class ${className}\n` : '';

    const base = cd.getExtends()?.getExpression().getText() || "";
    const type = base;
    // const isEvent = base === "CEvent"; // demonstration if needed

    // We'll create a local context for parsing this class
    const localCtx: CompilerContext = {
      ...context,
      localVarOffset: {},
      localVarCount: 0,
      initCode: '',
      paramMap: {},
      currentActorPicnum: undefined,
      currentActorExtra: undefined,
      currentActorIsEnemy: undefined,
      currentActorFirstAction: undefined,
      currentActorActions: [],
      currentActorMoves: [],
      currentActorAis: [],
      currentActorLabels: {},
      mainBFunc: false,
      curFunc: undefined,
    };

    let cls: SymbolDefinition;

    if (type == '') {
      cls = context.symbolTable.get(className) as SymbolDefinition;
      if (cls) {
        addDiagnostic(cd, context, 'error', `Duplicate definition. Tried to declare a class named ${className} when there's already a ${cls.type} with the same name`);
        return '';
      }

      context.symbolTable.set(className, {
        name: className,
        type: ESymbolType.class,
        offset: 0,
        num_elements: 0,
        size: 0,
        heap: true,
        children: {}
      });

      cls = context.symbolTable.get(className) as SymbolDefinition;
    }

    // visit constructor(s)
    const ctors = cd.getConstructors();
    if (ctors.length > 0 && type != '') {
      code += this.visitConstructorDeclaration(ctors[0], localCtx, type);
    }

    if(type == 'CActor') {
      localCtx.symbolTable.set('defaultPicnum', {
        name: 'defaultPicnum',
        offset: 0,
        type: ESymbolType.constant,
        literal: localCtx.currentActorPicnum
      });

      localCtx.symbolTable.set('defaultStrength', {
        name: 'defaultStrength',
        offset: 0,
        type: ESymbolType.constant,
        literal: localCtx.currentActorExtra
      });
    }

    // visit properties
    const properties = cd.getProperties();
    let codeV = '';

    for (const p of properties) {
      if(p.getTypeNode().getText().match(/\b(TAction|IAction|TMove|IMove|TAi|IAi)\b/)) {
        const init = p.getInitializerOrThrow();

        this.parseVarForActionsMovesAi(p, localCtx, className);
      }

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

            const evntLocalCtx: CompilerContext = {
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
      } else if (type == '') {
        const pName = p.getName();
        const pType = p.getTypeNode().getText();

        cls.children[pName] = { name: pName, offset: cls.num_elements, type: ESymbolType.number };

        switch (pType) {
          case 'string':
          case 'number':
          case 'pointer':
          case 'boolean':
            cls.children[pName].type = ESymbolType[pType];
            break;

          case 'string[]':
            cls.children[pName].type = ESymbolType.string | ESymbolType.array;
            break;

          case 'number[]':
          case '[]':
            cls.children[pName].type = ESymbolType.array;
            break;

          default:
            let t = pType;
            let isArray = false;
            if (t.endsWith('[]')) {
              t = pType.slice(0, t.length - 2);
              isArray = true;
            }

            const type = context.typeAliases.get(t);

            if (!type) {
              addDiagnostic(p, context, 'error', `Undeclared type ${pType}`);
              return '';
            }

            if (type.literal) {
              if (type.literal == 'string' && isArray)
                cls.children[pName].type = ESymbolType.string | ESymbolType.array;
              else if (isArray)
                cls.children[pName].type = ESymbolType.array;
              else cls.children[pName].type = type.literal as any;
            } else {
              cls.children[pName].type = ESymbolType.object | (isArray ? ESymbolType.array : 0);
              cls.children[pName].children = this.getObjectTypeLayout(t, context);
              cls.children[pName].size = this.getObjectSize(t, context);
              cls.children[pName].num_elements = Object.keys(cls.children[pName].children).length;
            }
        }
        cls.num_elements++;
      }
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

    if (ctors.length > 0 && type == '') {
      context.curClass = cls;
      code = `${this.options.lineDetail ? `/*${ctors[0].getText()}*/` : ''}\ndefstate ${className}_constructor \n  set ra rbp \n  state push \n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;
      code += indent(`state pushr2\nset r0 ${cls.num_elements}\nset r1 ${EHeapType.object}\nstate alloc\nstate popr2\nstate pushb\n`, 1);
      code += this.visitConstructorDeclaration(ctors[0], context, '');
      code += `  state popb\n  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\nends \n\n`;
    }

    // visit methods
    const methods = cd.getInstanceMethods();
    for (const m of methods)
      code += this.visitMethodDeclaration(m, className, type != '' ? localCtx : context, type);

    for(const p of properties) {
      if (p.getTypeNode().getText().includes('OnVariation')) {
        const init = p.getInitializerOrThrow();

        if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const events = init.getProperties();

          for (const e of events) {
            if (!e.isKind(SyntaxKind.MethodDeclaration)) {
              addDiagnostic(e, context, 'error', `OnVariation property must only contain functions: ${p.getText()}`);
              return '';
            }

            const eFnName = e.getName();

            const variationLocalCtx: CompilerContext = {
              ...localCtx,
              localVarOffset: {},
              localVarCount: 0,
              paramMap: {}
            };


            const body = e.getBody() as Block;
            if (body) {
              const stmts = body.getStatements() as Statement[];

              const cactor = body.getDescendantsOfKind(SyntaxKind.ReturnStatement)

              if(cactor.length == 0) {
                addDiagnostic(init, localCtx, 'error', `Missing return statement on actor variation: ${eFnName}`);
                return '';
              }

              const exp = cactor[0].getExpression();
              if(!exp.isKind(SyntaxKind.ObjectLiteralExpression)) {
                addDiagnostic(init, localCtx, 'error', `Return statement is not a object literal: ${exp.getText()}`);
                return '';
              }

              const obj: ObjectLiteralExpression = exp as ObjectLiteralExpression;

              let picnum = -1, extra = 0, action = '';

              obj.getProperties().forEach(e => {
                if(e.isKind(SyntaxKind.PropertyAssignment)) {
                  let val: string | number;
                  const init = e.getInitializer();

                  if(init.isKind(SyntaxKind.ElementAccessExpression) || init.isKind(SyntaxKind.PropertyAccessExpression))
                    val = this.visitMemberExpression(init, localCtx, false, true);

                  if(init.isKind(SyntaxKind.Identifier))
                    val = this.visitLeafOrLiteral(init, localCtx, true);

                  switch(e.getName()) {
                    case 'picnum':
                      picnum = Number(val);
                      break;

                    case 'extra':
                      extra = Number(val);
                      break;

                    case 'first_action':
                      action = String(val);
                      break;
                  }
                }
              });

              codeV += `${this.options.lineDetail ? `\n/*${e.getText()}*/` : ''}\nuseractor ${localCtx.currentActorIsEnemy ? 1 : 0} ${picnum} ${extra} ${action}\nset ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;

              stmts.forEach(s => {
                if(!s.isKind(SyntaxKind.ReturnStatement))
                  codeV += this.visitStatement(s, variationLocalCtx);
              });
            }

            codeV += `  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nenda \n\n`;
          }
        }
      }
    }

    code += codeV;

    context.curClass = null;

    code = (localCtx.initCode != '' ? `appendevent EVENT_SETDEFAULTS\n${indent(localCtx.initCode, 1)}\n  add ri 1\n  set rbp ri\n  set rsp rbp\n  sub rsp 1\nendevent\n\n` : '') + code;

    return code;
  }

  /******************************************************************************
   * CONSTRUCTOR => skip code, parse object literals for IAction, IMove, IAi, parse super(...) for picnum
   ****************************************************************************/
  private visitConstructorDeclaration(
    ctor: ConstructorDeclaration,
    context: CompilerContext,
    type: string,
  ): string {
    let code = '';
    const body = ctor.getBody() as Block;
    if (body) {
      if (type == 'CActor') {
        const statements = body.getStatements();
        if(statements.length > 1) {
          addDiagnostic(ctor, context, 'warning', `Only super calls are allowed inside CActor constructors`);
        }
        for (const st of statements) {
          // expression => super(...)
          if (st.isKind(SyntaxKind.ExpressionStatement)) {
            const es = st as ExpressionStatement;
            const expr = es.getExpression();
            if (expr.isKind(SyntaxKind.CallExpression)) {
              const call = expr as CallExpression;
              if (call.getExpression().getText() === "super") {
                this.parseActorSuperCall(call, context);
              } else {
                addDiagnostic(ctor, context, 'warning', `Only super calls are allowed inside CActor constructors`);
              }
            }
          }
        }
      } else if (type == 'CEvent') {
        const statements = body.getStatements();
        if(statements.length > 1) {
          addDiagnostic(ctor, context, 'warning', `Only super calls are allowed inside CEvent constructors`);
        }
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
              } else {
                addDiagnostic(ctor, context, 'warning', `Only super calls are allowed inside CActor constructors`);
              }
            }
          }
        }
      } else {
        const statements = body.getStatements();
        const localCtx: CompilerContext = {
          ...context,
          localVarOffset: {},
          localVarCount: 0,
          paramMap: {},
          curFunc: undefined,
        };
        ctor.getParameters().forEach((p, i) => {
          const type = p.getType();
          let t: Exclude<ESymbolType, ESymbolType.enum> = ESymbolType.number;
          let children: Record<string, SymbolDefinition>;
          let con = '';
          switch (type.getText()) {
            case 'string':
            case 'pointer':
            case 'boolean':
              t = ESymbolType[type.getText()];
              break;

            case 'constant':
            case 'number':
              break;

            case 'quote':
              t = ESymbolType.quote;
              break;

            case 'string[]':
              t = ESymbolType.string | ESymbolType.array;
              break;

            case 'number[]':
            case '[]':
            case 'any[]':
              t |= ESymbolType.array;
              break;

            default:
              let tText = type.getText();

              if (type.getText().endsWith('[]')) {
                t = ESymbolType.object | ESymbolType.array;
                tText = tText.slice(0, tText.length - 2);
              } else t = ESymbolType.object;

              const alias = context.typeAliases.get(tText);

              if (!alias) {
                addDiagnostic(ctor, context, 'error', `Undeclared type alias ${tText}`);
                return '';
              }

              children = this.getObjectTypeLayout(tText, context);
          }
          localCtx.paramMap[p.getName()] = { name: p.getName(), offset: i, type: t, children };
        });
        for (const st of statements) {
          code += indent(this.visitStatement(st, localCtx), 1);
        }
      }
    }
    return code;
  }

  /* ------------------------------------------------------------------
 * 1.  Top-level router that recognises both the old and new shapes
 * ------------------------------------------------------------------ */
  private parseVarForActionsMovesAi(
    decl: PropertyDeclaration,
    ctx: CompilerContext,
    className: string
  ) {
    const typeNode = decl.getTypeNode();
    if (!typeNode) return;

    /* ── 1. figure out declared type and “arrayness” ─────────────── */
    let typeTxt = typeNode.getText().trim();
    let isArray = false;

    if (typeTxt.endsWith("[]")) {
      isArray = true;
      typeTxt = typeTxt.slice(0, -2).trim();              //  Foo[]      → Foo
    } else {
      const m = /^Array<\s*(.+?)\s*>$/.exec(typeTxt);
      if (m) {
        isArray = true;
        typeTxt = m[1].trim();                            // Array<Foo>  → Foo
      }
    }

    /* 🔥 2️⃣  NEW RULE: arrays are no longer accepted --------------- */
  if (isArray) {
    addDiagnostic(decl, ctx, 'error', `Array type for Action/Move/AI is not supported`);
    return;
  }

    // strip generic parameters so we end up with IAction / TAction …
    const baseType = typeTxt.slice(0, typeTxt.indexOf('<'));         // TAction<'a'> → TAction

    /* ── 2. grab initializer ─────────────────────────────────────── */
    const init = decl.getInitializer();
    if (!init) return;

    let sym: SymbolDefinition;

    /* helper that forwards to the correct low-level parser */
    const handleObj = (obj: ObjectLiteralExpression, propName?: string) => {
      let s: SymbolDefinition;
      switch (baseType) {
        case "IAction":
        case "TAction":
          s = this.parseIActionLiteral(obj, ctx, propName, className);
          break;

        case "IMove":
        case "TMove":
          s = this.parseIMoveLiteral(obj, ctx, propName, className);
          break;

        case "IAi":
        case "TAi":
          s = this.parseIAiLiteral(obj, ctx, propName, className);
          break;
      }

      return s;
    };

    /* ── 3. OLD SHAPES ───────────────────────────────────────────── */
    // 3 a) single object → IAction / IMove / IAi
    if (!isArray && !/^[T][A-Z]/.test(baseType)) {        // not TAction / …
      if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const sym = handleObj(init as ObjectLiteralExpression, decl.getName());
        sym.global = true;
        ctx.symbolTable.set(decl.getName(), sym);
        ctx.currentActorLabels[decl.getName()] = sym;
        sym.offset = ctx.globalVarCount;
        let code = `set ri ${ctx.globalVarCount + 1}\nsetarray flat[${ctx.globalVarCount}] ri\nsetarray flat[ri] ${sym.name}\n`;
        ctx.globalVarCount += 2;
        Object.entries(sym.children).forEach(e => {
          e[1] = e[1] as SymbolDefinition;
          code += `add ri 1\nsetarray flat[ri] ${e[1].literal}\n`
          ctx.globalVarCount++;
        });

        ctx.initCode += code;
      }
      return;
    }

    /* ── 4. NEW SHAPE  (dictionary) ─────────────────────────────── */
    // top-level object whose *properties* are the actions / moves / ais
    if (!init.isKind(SyntaxKind.ObjectLiteralExpression)) return;

    ctx.symbolTable.set(decl.getName(), {
      name: decl.getName(),
      offset: ctx.globalVarCount,
      global: true,
      readonly: true,
      type: ESymbolType.object | ESymbolType.pointer,
      children: {}
    });

    let code = `set ri ${ctx.globalVarCount + 1}\nsetarray flat[${ctx.globalVarCount}] ri\n`;
    ctx.globalVarCount++;

    const obj = ctx.symbolTable.get(decl.getName()) as SymbolDefinition;
    obj.num_elements = obj.size = 0;
    let code2 = '';

    (init as ObjectLiteralExpression).getProperties().forEach((prop, i, a) => {
      if (!prop.isKind(SyntaxKind.PropertyAssignment)) return;

      const propName = prop.getName().replace(/[`'"]/g, ""); // walk / run / …
      const value = prop.getInitializer();
      if (value && value.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const sym = handleObj(value as ObjectLiteralExpression, propName);
        ctx.currentActorLabels[propName] = sym;
        obj.children[propName] = sym;
        obj.num_elements++;
        obj.size += sym.size;
        sym.offset = i;
        code += `set ri ${ctx.globalVarCount + a.length + i}\nsetarray flat[${ctx.globalVarCount}] ri\n`;
        code2 += `add ri 1\nsetarray flat[ri] ${sym.name}\n`;
        ctx.globalVarCount++;
        Object.entries(sym.children).forEach(e => {
          e[1] = e[1] as SymbolDefinition;
          code2 += `add ri 1\nsetarray flat[ri] ${e[1].literal}\n`
        });
      }
    });

    code += code2;
    ctx.globalVarCount += obj.size;
    ctx.initCode += code;
  }

  /* ------------------------------------------------------------------
   * 2.  Low-level helpers – accept an *optional* fallback name
   * ------------------------------------------------------------------ */
  private parseIActionLiteral(
    obj: ObjectLiteralExpression,
    ctx: CompilerContext,
    fallbackName = "",
    className: string,
  ): SymbolDefinition {
    let start = 0, length = 0, viewType = 0, inc = 0, delay = 0;

    obj.getProperties().forEach(p => {
      if (!p.isKind(SyntaxKind.PropertyAssignment)) return;
      const key = p.getName();
      const val = p.getInitializerOrThrow().getText();
      switch (key) {
        case "start": start = +val; break;
        case "length": length = +val; break;
        case "viewType": viewType = +val; break;
        case "incValue": inc = +val; break;
        case "delay": delay = +val; break;
      }
    });

    ctx.currentActorActions.push(
      `action A_${className}_${fallbackName} ${start} ${length} ${viewType} ${inc} ${delay}`,
    );

    return {
      name: `A_${className}_${fallbackName}`,
      offset: 0,
      type: ESymbolType.object | ESymbolType.pointer,
      num_elements: 6,
      size: 6,
      readonly: true,
      literal: `A_${className}_${fallbackName}`,
      children: {
        loc: { name: 'loca', type: ESymbolType.number, offset: 0, literal: `A_${className}_${fallbackName}` },
        start: { name: 'start', type: ESymbolType.number, offset: 1, literal: start },
        length: { name: 'length', type: ESymbolType.number, offset: 2, literal: length },
        viewType: { name: 'viewType', type: ESymbolType.number, offset: 3, literal: viewType },
        incValue: { name: 'incValue', type: ESymbolType.number, offset: 4, literal: inc },
        delay: { name: 'delay', type: ESymbolType.number, offset: 5, literal: delay },
      }
    };
  }

  private parseIMoveLiteral(
    obj: ObjectLiteralExpression,
    ctx: CompilerContext,
    fallbackName = "",                                // 🔑 NEW
    className: string,
  ): SymbolDefinition {
    let hv = 0, vv = 0;

    obj.getProperties().forEach(p => {
      if (!p.isKind(SyntaxKind.PropertyAssignment)) return;
      const key = p.getName();
      const val = +p.getInitializerOrThrow().getText();
      switch (key) {
        case "horizontal_vel": hv = val; break;
        case "vertical_vel": vv = val; break;
      }
    });

    ctx.currentActorMoves.push(`move M_${className}_${fallbackName} ${fallbackName} ${hv} ${vv}`);

    return {
      name: `M_${className}_${fallbackName}`,
      offset: 0,
      type: ESymbolType.object | ESymbolType.pointer,
      num_elements: 3,
      size: 3,
      readonly: true,
      literal: `M_${className}_${fallbackName}`,
      children: {
        loc: { name: 'loca', type: ESymbolType.number, offset: 0, literal: `M_${className}_${fallbackName}` },
        horizontal_vel: { name: 'horizontal_vel', type: ESymbolType.number, offset: 1, literal: hv },
        vertical_vel: { name: 'vertical_vel', type: ESymbolType.number, offset: 2, literal: vv },
      }
    };
  }

  private parseIAiLiteral(
    obj: ObjectLiteralExpression,
    ctx: CompilerContext,
    fallbackName = "",                                // 🔑 NEW
    className: string,
  ): SymbolDefinition {
    let action: SymbolDefinition, move: SymbolDefinition; let flags = 0;

    obj.getProperties().forEach(p => {
      if (!p.isKind(SyntaxKind.PropertyAssignment)) return;
      const key = p.getName();
      const valNode = p.getInitializerOrThrow();
      const segments = this.unrollMemberExpression(valNode);
      const seg: SegmentProperty = segments[segments.length - 1] as SegmentProperty;
      switch (key) {
        case "action": action = ctx.currentActorLabels[seg.name]; break;
        case "move": move = ctx.currentActorLabels[seg.name]; break;
        case "flags": flags = evalLiteral(valNode, ctx); break;
      }
    });

    ctx.currentActorAis.push(`ai AI_${className}_${fallbackName} ${action.literal} ${move.literal} ${flags}`);

    return {
      name: `AI_${className}_${fallbackName}`,
      offset: 0,
      type: ESymbolType.object,
      num_elements: 4,
      size: 4,
      readonly: true,
      literal: `AI_${className}_${fallbackName}`,
      children: {
        loc: { name: 'loc', type: ESymbolType.number | ESymbolType.pointer, offset: 0, literal: `AI_${className}_${fallbackName}` },
        action: action,
        move: move,
        flags: { name: 'flags', type: ESymbolType.number, offset: 3, literal: flags },
      }
    };
  }


  private parseActorSuperCall(call: CallExpression, context: CompilerContext) {
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

      if (fa && (fa.getText() != 'undefined' && fa.getText() != 'null')) {
        const sym = context.symbolTable.get(fa.getText());

        if (!sym) {
          addDiagnostic(call, context, 'error', `Action ${fa.getText()} is not declared`);
          return;
        }

        context.currentActorFirstAction = sym.name.replace(/[`'"]/g, "");
      }
    }
  }

  /******************************************************************************
   * visitMethodDeclaration => if main() => useractor ...
   ****************************************************************************/
  private visitMethodDeclaration(
    md: MethodDeclaration,
    className: string,
    context: CompilerContext,
    type: string
  ): string {
    const mName = md.getName();
    const curFunc = context.curFunc;
    const localCtx: CompilerContext = {
      ...context,
      localVarOffset: {},
      localVarCount: 0,
      paramMap: {},
      isInLoop: false,
      mainBFunc: false,
      curFunc: undefined,
      hasLocalVars: false
    };

    if (type == 'CActor' && mName.toLowerCase() === "main") {
      const pic = localCtx.currentActorPicnum || 0;
      const extra = localCtx.currentActorExtra || 0;
      const firstAction = localCtx.currentActorFirstAction || "0";
      const enemy = localCtx.currentActorIsEnemy ? 1 : 0;
      localCtx.mainBFunc = true;
      let code = `${this.options.lineDetail ? `/*${md.getText()}*/` : ''}\nuseractor ${enemy} ${pic} ${extra} ${firstAction} \n  findplayer playerDist\n  set ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;
      md.getParameters().forEach((p, i) => {
        const type = p.getType();
        let t: Exclude<ESymbolType, ESymbolType.enum> = ESymbolType.number;
        let children: Record<string, SymbolDefinition>;
        let con = '';
        switch (type.getText()) {
          case 'string':
          case 'boolean':
          case 'pointer':
            t = ESymbolType[type.getText()];
            break;

          case 'constant':
          case 'number':
            break;

          case 'string[]':
            t = ESymbolType.string | ESymbolType.array;
            break;

          case 'quote':
            t = ESymbolType.quote;
            break;

          case 'number[]':
          case '[]':
          case 'any[]':
            t |= ESymbolType.array;
            break;

          default:
            let tText = type.getText();

            if (type.getText().endsWith('[]')) {
              t = ESymbolType.object | ESymbolType.array;
              tText = tText.slice(0, tText.length - 2);
            } else t = ESymbolType.object;

            const alias = context.typeAliases.get(tText);

            if (!alias) {
              addDiagnostic(md, context, 'error', `Undeclared type alias ${tText}`);
              return '';
            }

            children = this.getObjectTypeLayout(tText, context);
        }
        localCtx.paramMap[p.getName()] = { name: p.getName(), offset: i, type: t, children };
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
    let code = `${this.options.lineDetail ? `/*${md.getText()}*/` : ''}\ndefstate ${className}_${mName}\n`;

    if(md.getDescendantsOfKind(SyntaxKind.VariableDeclaration).length > 0) {
      localCtx.hasLocalVars = true;
      code += `  set ra rbp \n  state push \n  set rbp rsp\n  add rbp 1\n`;
    }

    md.getParameters().forEach((p, i) => {
      const type = p.getType();
      let t: Exclude<ESymbolType, ESymbolType.enum> = ESymbolType.number;
      let children: Record<string, SymbolDefinition>;
      let con = '';
      switch (type.getText()) {
        case 'string':
        case 'boolean':
        case 'pointer':
          t = ESymbolType[type.getText()];
          break;

        case 'constant':
        case 'number':
          break;

        case 'string[]':
          t = ESymbolType.string | ESymbolType.array;
          break;

        case 'quote':
          t = ESymbolType.quote;
          break;

        case 'number[]':
        case '[]':
        case 'any[]':
          t |= ESymbolType.array
          break;

        default:
          let tText = type.getText();

          if (type.getText().endsWith('[]')) {
            t = ESymbolType.array | ESymbolType.object;
            tText = tText.slice(0, tText.length - 2);
          } else t = ESymbolType.object;

          let alias = context.typeAliases.get(tText);

          if (!alias) {
            //Since it's a parameter, we can try to store this type
            const typeR = this.getTypeBase(p.getTypeNode(), context);

            if (!typeR) {
              addDiagnostic(md, context, 'error', `Undeclared type alias ${tText}`);
              return '';
            }

            t = ESymbolType[typeR];
          }

          if (t & ESymbolType.object)
            children = this.getObjectTypeLayout(tText, context);
      }
      localCtx.paramMap[p.getName()] = { name: p.getName(), offset: i, type: t, children };
    });

    localCtx.symbolTable.set(mName, {
      name: `${className}_${mName}`,
      type: ESymbolType.function,
      offset: 0,
    });

    localCtx.curFunc = localCtx.symbolTable.get(mName) as SymbolDefinition;
    if (type == '') {
      context.curClass.children[mName] = localCtx.symbolTable.get(mName);
      const numParams = Object.keys(localCtx.paramMap).length;

      code += indent(`setarray flat[rbp] r${numParams}\nadd rsp 1\n`, 1);
      localCtx.localVarCount++;
    }

    const t = md.getReturnType();
    const tSym = t.getAliasSymbol();
    if(tSym && tSym.getName().includes('CON_NATIVE_STATE')) {
      const args = t.getAliasTypeArguments();

      if(args.length > 0) {
        (localCtx.symbolTable.get(mName) as SymbolDefinition).CON_code = args[0].getText().replace(/[`'"]/g, "");
        (context.symbolTable.get(mName) as SymbolDefinition).CON_code = args[0].getText().replace(/[`'"]/g, "");
      };
    }

    const body = md.getBody() as any;
    if (body) {
      body.getStatements().forEach(st => {
        code += indent(this.visitStatement(st, localCtx), 1) + "\n";
      });
    }

    context.curFunc = curFunc;
    if(md.getDescendantsOfKind(SyntaxKind.VariableDeclaration).length > 0)
      code += `  sub rbp 1\n  set rsp rbp\n  state pop\n  set rbp ra\n`;

    code += `ends\n\n`;
    return code;
  }
}
