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
import { CompiledModule } from "./Intermediate";
import { visitFunctionDeclaration } from './services/visitFunctionDeclaration';
import { visitClassDeclaration } from './services/visitClassDeclaration';
import { visitStatement } from './services/visitStatement';
import { visitModuleDeclaration } from './services/visitModuleDeclaration';
import { colorText } from '../../main';
import { indent } from './helper/indent';
import { createHash } from 'crypto';

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
  symbolPrint?: boolean;

  mode?: 'single' | 'module';

  stackSize?: number;    // From typecon.json / CLI; used for memory warnings
  heapNumPages?: number; // From typecon.json / CLI; used for memory warnings

  varOverrides?: Map<string, number>; // --vars NAME=VALUE overrides for gameVar initial values
  soundSlotStart?: number;            // --sound-slot N: base index for auto-assigned Sound IDs
}

export enum EHeapType {
  array = 1,
  string = 2,
  object = 4,
  string_array = 8,
  peractor = 16,   // per-actor property block; GC scans allsprites rather than stack
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
  sub_function = 131072, // Function or arrow function saved as reference/pointer
  fixed_point = 262144,  // Value uses fixed-point representation; fp_bits gives the precision shift
  record = 524288        // Record<string, T> native hash-map
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
  astNode?: any,        // ClassDeclaration — stored so derived classes can re-run parent event handlers
  global?: boolean,
  readonly?: boolean,
  native_pointer?: 'sprites' | 'sectors' | 'walls' | 'players' | 'projectiles',
  //This is only used IF we do something like 'const s = sprites[2]', 
  //otherwise, the compiler treats like a pointer to the complete array structure: 'const s = sprites'
  native_pointer_index?: boolean,

  children?: { [key: string]: SymbolDefinition | EnumDefinition }; // For nested objects or enums.
  CON_code?: string,
  nativeAlias?: boolean,  // True for CON_FUNC_ALIAS props — callable via this.Method() → plain native dispatch
  returns?: Exclude<ESymbolType, ESymbolType.enum> | null;
  literal?: string | number | null; //Can hold the sub function address
  isLabel?: boolean;               // True for GameLabel / Sound — emit symbol name instead of literal in CONSTANT positions
  parent?: SymbolDefinition;
  parentFunc?: string; // Name of the function this symbol belongs to (for locals)
  parentClass?: string; // Name of the class this symbol belongs to
  class_name?: string;  // For class-typed variables: the name of the instantiated class (e.g. 'CRecord')
  fp_bits?: 11 | 14 | 16 | 30;          // Fixed-point precision shift (undefined = plain integer)
  returns_fp_bits?: 11 | 14 | 16 | 30;  // FP precision of return value (functions only)
  param_fp_bits?: (11 | 14 | 16 | 30 | 0)[];  // FP precision per parameter (functions only)
  returns_class_name?: string;               // For functions returning a class instance: the class name
  record_value_type?: Exclude<ESymbolType, ESymbolType.enum>;  // For Record<string, T>: value type T
  record_value_fpbits?: 11 | 14 | 16 | 30;  // For Record<string, FPX>: fixed-point precision
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

export interface ISubFunction {
  code: string
  hash: string
  index: number
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

  soundSlotCounter: number;  // auto-incremented for Sound declarations with no explicit id

  // For CActor:
  currentActorPicnum?: number;
  currentActorPicnumLabel?: string; // label name if picnum was a GameLabel, e.g. "TILE_EGG"
  currentActorExtra?: number;
  currentActorIsEnemy?: boolean;
  currentActorFirstAction?: string;
  currentActorActions: string[];
  currentActorMoves: string[];
  currentActorAis: string[];
  currentActorLabels: Record<string, SymbolDefinition>;
  currentActorLabelAsObj: boolean;
  currentActorHardcoded: boolean;
  isPlayer?: boolean;

  // For event classes if needed
  currentEventName?: string;

  // Set when compiling a derived plain class — the name of the parent class being extended
  currentParentClass?: string;

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

  // Tracking for Module Compilation
  globalAllocations: Array<{ name: string, size: number }>;
  // We will likely generate relocations by scanning tokens in the final string, 
  // but we can store metadata here if needed.

  initCode: string;

  subFunction: ISubFunction; //Sub-functions are per file
  isInSubFunction: boolean;

  inSwitch: boolean;
  hasLocalVars: boolean;
  usingRD: boolean;
  isDebugTest: boolean;
  curFpBits: 0 | 11 | 14 | 16 | 30;  // FP precision of the value currently in ra/rd (0 = integer)
  declaredFpBits: 0 | 11 | 14 | 16 | 30; // ambient FP precision from enclosing variable declaration; survives visitExpression resets
  nativeArgFpHint: 0 | 11 | 14 | 16 | 30; // expected FP precision for the current native argument (set by visitCallExpression, consumed by visitLeafOrLiteral)
  rfxAllocated: number;               // How many rfx0..rfx3 scratch registers are in use (0..4)
  project: Project;
  headerDefines: string[];
  gameVarDeclarations: string[]; // CON gamevar lines that must appear at the top of output

  // Non-native CActor/CPlayer property children, keyed by prop name.
  // Set during CActor/CPlayer class compilation; consumed by visitMemberExpression
  // to emit getactorvar[THISACTOR]._pCptr + flat[] access for custom props.
  actorCustomChildren?: Record<string, SymbolDefinition>;

  // CON code from the body of a CActor/CPlayer constructor (after the super() call).
  // Compiled by visitConstructorDeclaration; emitted into EVENT_SPAWN after _pCptr allocation.
  actorCustomInitCode?: string;
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
      console.error(`${colorText('Could not resolve', 'red')} '${importPath}' from '${baseFile}'`);
      return null;
    }
  }


  public compile(sourceCode: string, file: string, prvContext?: CompilerContext): CompileResult {
    const sf = this.project.createSourceFile(`temp_${Buffer.from(file).toString('base64url')}.ts`, sourceCode, {
      overwrite: true
    });

    if (prvContext) {
      if (prvContext.subFunction)
        prvContext.subFunction = {
          code: '',
          hash: '',
          index: 0,
        }
    }

    const context: CompilerContext = prvContext ? prvContext : {
      localVarOffset: {},
      localVarCount: 0,
      localVarNativePointer: undefined,
      localVarNativePointerIndexed: false,
      paramMap: {},
      diagnostics: [],
      options: this.options,

      globalVarCount: 0,
      soundSlotCounter: this.options.soundSlotStart ?? 400,

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

      subFunction: {
        code: '',
        hash: '',
        index: 0
      },
      isInSubFunction: false,

      initCode: '',
      inSwitch: false,
      hasLocalVars: false,
      usingRD: false,
      isDebugTest: false,
      curFpBits: 0,
      declaredFpBits: 0,
      nativeArgFpHint: 0,
      rfxAllocated: 0,
      project: this.project,

      globalAllocations: [],
      headerDefines: [],
      gameVarDeclarations: []
    };

    const outputLines: string[] = [];

    // Normalize cache key: src/sets/TCSet100/ and include/TCSet100/ are the same
    // files (include/ is a generated copy of src/sets/).  Canonicalize to the
    // include/ path so imports via either prefix share one cache entry.
    const cacheKey = Buffer.from(
      file.replace(/[/\\]src[/\\]sets[/\\]TCSet100[/\\]/g, '/include/TCSet100/')
    ).toString('base64url');

    if (compiledFiles.get(cacheKey)) {
      const cached = compiledFiles.get(cacheKey);
      if (context) {
        for (const [name, sym] of cached.context.symbolTable) {
          if (!context.symbolTable.has(name))
            context.symbolTable.set(name, sym);
        }
      }
      return null;
    }

    compiledFiles.set(cacheKey, {
      path: file,
      code: '',
      declaration: false,
      context,
      options: ECompileOptions.none,
      dependency: []
    })

    context.currentFile = compiledFiles.get(cacheKey);

    const imports = sf.getImportDeclarations();

    if (imports.length > 0) {
      for (const i of imports) {
        const fName = i.getModuleSpecifierValue();

        const cFile = path.basename(file);

        const resolved = this.resolveImport(file, fName);
        if (!resolved) {
          console.log(`\n${colorText('Unable to include file:', 'red')} ${fName}`);
          continue;
        }

        const resolvedKey = Buffer.from(
          resolved.replace(/[/\\]src[/\\]sets[/\\]TCSet100[/\\]/g, '/include/TCSet100/')
        ).toString('base64url');
        if (compiledFiles.has(resolvedKey)) {
          // Import already compiled in a previous file — inject its symbols so
          // the current file can reference its types, but skip re-emitting code.
          const cachedImport = compiledFiles.get(resolvedKey);
          if (cachedImport?.context?.symbolTable) {
            for (const [name, sym] of cachedImport.context.symbolTable) {
              if (!context.symbolTable.has(name))
                context.symbolTable.set(name, sym);
            }
          }
          continue;
        }

        try {
          const modName = path.basename(resolved, '.ts'); // Use basename for now as identifier
          context.currentFile.dependency.push(modName);
          const prvFile = context.currentFile;
          const sCode = fs.readFileSync(resolved);
          const includeResult = this.compile(sCode.toString(), resolved, context);
          if (includeResult?.conOutput?.trim())
            outputLines.push(includeResult.conOutput);
          context.currentFile = prvFile;
          context.diagnostics.length = 0;
        } catch (err) {
          console.log(`\n${colorText('Cannot open include file:', 'red')} ${resolved}`);
          console.log(err);
        }
      }
    }

    if (prvContext)
      console.log(`\n${colorText('Including', 'yellow')}' ${file}...`);

    // Parse markers from source comment (case-insensitive)
    const setVersionMatch = sourceCode.match(/\/\/@setVersion=(\d+)/i);
    if (setVersionMatch) {
      context.headerDefines.push(`define LANGUAGE_SET_VERSION ${setVersionMatch[1]}`);
    }

    const langSetMatch = sourceCode.match(/\/\/@langSet=([\w.-]+)/i);
    if (langSetMatch) {
      const name = langSetMatch[1];
      // Generate a 6-character hex hash from the name
      const hash = createHash('md5').update(name).digest('hex').substring(0, 6).toUpperCase();
      context.headerDefines.push(`define LANGUAGE_SET 0x${hash}`);
    }

    const modules = sf.getModules();

    if (modules.length > 0) {
      if (modules.findIndex(e => e.getName() == 'noread') != -1) {
        context.currentFile.options = ECompileOptions.no_read;
        console.log(`Ignoring...`);
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
          console.log(`\n${colorText('Compiling', 'yellow')}' ${file}...`);
      }
    } else console.log(`\n${colorText('Compiling', 'yellow')}' ${file}...`);

    const keysBefore = new Set(context.symbolTable.keys());

    sf.getStatements().forEach(st => {
      if (st.isKind(SyntaxKind.FunctionDeclaration)) {
        outputLines.push(visitFunctionDeclaration(st as FunctionDeclaration, context));
      } else if (st.isKind(SyntaxKind.ClassDeclaration) && !(context.currentFile.options & ECompileOptions.no_compile)) {
        outputLines.push(visitClassDeclaration(st as ClassDeclaration, context));
      } else if (st.isKind(SyntaxKind.ModuleDeclaration)) {
        const result = visitModuleDeclaration(st as any, context);
        outputLines.push(result.definitions);
        context.initCode += result.initialization;
      } else {
        const stmtCode = visitStatement(st, context);
        if (stmtCode.trim() !== '') {
          // If we are at the top level of the file/module, redirect code to initCode
          // which will be wrapped in EVENT_NEWGAME
          if (!context.curFunc && !context.curClass) {
            context.initCode += stmtCode;
          } else {
            outputLines.push(stmtCode);
          }
        }
      }
    });

    const definedSymbols: string[] = [];
    context.symbolTable.forEach((v, k) => {
      if (!keysBefore.has(k)) definedSymbols.push(k);
    });
    context.currentFile.definedSymbols = definedSymbols;

    if (context.subFunction.code != '') {
      //Finish the sub-functions routine
      context.subFunction.code += indent(`endswitch\n`, 2)
        + indent('} else {\n', 1)
        + indent(`set rd 1\ngetcurraddress ra\nife rd 1\n{\n`, 2)
        + indent(`state push\njump rb\n`, 3)
        + indent('}\n', 2)
        + indent('}\nstate popd\n', 1)
        + 'ends\n';
      outputLines.unshift(context.subFunction.code);
      // Clear the code after emitting so parent compile calls in the import chain
      // don't re-emit the same dispatch state (preserving index so case numbers don't collide).
      context.subFunction = { code: '', hash: '', index: context.subFunction.index };
    }

    if (context.gameVarDeclarations.length > 0) {
      outputLines.unshift(context.gameVarDeclarations.join(''));
      context.gameVarDeclarations = [];
    }

    if (context.initCode !== '') {
      outputLines.unshift(`\nonevent EVENT_NEWGAME\n${indent(context.initCode, 1)}\nadd rsp 1\nendevent\n`);
      context.initCode = '';
    }

    const finalOutput = outputLines;
    context.currentFile.code = finalOutput.join('\n');

    if (context.diagnostics.length > 0) {
      console.log(colorText('=== DIAGNOSTICS ===', 'red'));

      for (const diag of context.diagnostics) {
        console.log(`[${diag.severity == 'error' ? colorText('ERROR', 'red') : colorText('WARNING', 'yellow')}] line ${diag.line}: ${colorText(diag.message, 'magenta')}`);
      }
      console.log('\n');
    } else {
      console.log(colorText('Succesfully compiled', 'green') + ` ${file}`);
    }

    return {
      conOutput: outputLines.join("\n"),
      diagnostics: context.diagnostics,
      context
    };
  }

  public compileModule(sourceCode: string, file: string, prvContext?: CompilerContext): { module: CompiledModule, context: CompilerContext } | null {
    // Force module mode
    this.options.mode = 'module';
    const result = this.compile(sourceCode, file, prvContext);

    if (!result) return null;

    // We no longer scan for relocations or build a table.
    // The markers (e.g. _G_ADDR_xxx) are embedded in the code string.
    // The linker will parse the code and context to resolve them.

    const finalDeps = (result.context.currentFile.dependency || []).filter(depName => {
      // Look for the compiled file in the global cache to check its options
      for (const cf of compiledFiles.values()) {
        if (path.basename(cf.path, '.ts') === depName) {
          // If it's a "system" module that doesn't produce code, it's not a linker dependency
          if (cf.options & (ECompileOptions.no_compile | ECompileOptions.state_decl | ECompileOptions.no_read)) {
            return false;
          }
        }
      }
      return true;
    });

    return {
      module: {
        name: path.basename(file, '.ts'),
        version: '1.0',
        context: Object.fromEntries(result.context.symbolTable),
        globalAllocations: result.context.globalAllocations,
        markerDefines: [...new Set(result.context.headerDefines)],
        code: result.conOutput,
        dependencies: finalDeps
      },
      context: result.context
    };
  }
}
