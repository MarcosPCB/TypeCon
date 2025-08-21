import fs from 'fs';
import path from 'path';
import {
  Project,
  SyntaxKind,
  Expression,
  FunctionDeclaration,
  ClassDeclaration,
} from "ts-morph";
import { compiledFiles, ECompileOptions, ICompiledFile, pageSize } from "./framework";
import { visitFunctionDeclaration } from './services/visitFunctionDeclaration';
import { visitClassDeclaration } from './services/visitClassDeclaration';
import { visitStatement } from './services/visitStatement';

export type DiagnosticSeverity = "error" | "warning";

export interface SegmentIdentifier {
  kind: "identifier" | "this";
  name: string; // e.g. "foo" or "this"
}

export interface SegmentProperty {
  kind: "property";
  name: string; // e.g. "bar"
}

export interface SegmentIndex {
  kind: "index";
  expr: Expression; // the expression inside [...], e.g. "baz"
}

export type MemberSegment = SegmentIdentifier | SegmentProperty | SegmentIndex;

interface CompileDiagnostic {
  line: number;
  message: string;
  severity: DiagnosticSeverity;
}

export interface CompilerOptions {
  debug?: boolean;
  lineDetail?: boolean;
}

export enum EHeapType {
  array = 1,
  string = 2,
  object = 4,
  string_array = 8,
}

export enum ESymbolType {
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
export interface SymbolDefinition {
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
  parent?: SymbolDefinition;
}

export interface TypeAliasDefinition {
  name: string;
  members: Record<string, string>; // property name -> type (as a string)
  literal?: string;
  union?: TypeAliasDefinition;
  membersCode?: Record<string, string>;
}

export interface EnumDefinition {
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
  currentActorLabelAsObj: boolean;
  currentActorHardcoded: boolean;

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
  project: Project;
}

export interface CompileResult {
  conOutput: string;
  diagnostics: CompileDiagnostic[];
  context: CompilerContext
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

  private resolveImport(baseFile: string, importPath: string): string | null {
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
      currentActorHardcoded: false,
      currentActorLabelAsObj: true,
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
      usingRD: false,
      project: this.project
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

        const resolved = this.resolveImport(file, fName);
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

    const options = context.options

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
        outputLines.push(visitFunctionDeclaration(st as FunctionDeclaration, context));
      } else if (st.isKind(SyntaxKind.ClassDeclaration) && !(context.currentFile.options & ECompileOptions.no_compile)) {
        outputLines.push(visitClassDeclaration(st as ClassDeclaration, context));
      } else {
        outputLines.push(visitStatement(st, context));
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
      diagnostics: context.diagnostics,
      context
    };
  }
}
