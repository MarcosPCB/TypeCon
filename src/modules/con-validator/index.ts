import * as fs   from 'fs';
import * as path from 'path';
import { Validator }    from './Validator';
import { SymbolTable }  from './SymbolTable';

export interface Diagnostic {
  severity: 'error' | 'warning';
  line: number;
  col: number;
  code: string;
  message: string;
  /** Absolute path of the included file this diagnostic originates from, if any. */
  file?: string;
}

export interface IncludedFileResult {
  filePath: string;
  diagnostics: Diagnostic[];
  gamevarsDelta: number;
  arraysDelta: number;
  statesDelta: number;
  definesDelta: number;
  actionsDelta: number;
  movesDelta: number;
  aisDelta: number;
  quotesDelta: number;
}

export interface ValidationResult {
  diagnostics: Diagnostic[];
  symbolTable: SymbolTable;
  ok: boolean;
  includedFiles: IncludedFileResult[];
}

export interface ValidateOptions {
  /** Emit warnings when gamevar/array counts approach EDuke32 limits (default: true) */
  warnNearLimits?: boolean;
  /** Directories to search when resolving `include` directives (first match wins) */
  baseDirs?: string[];
}

// Extract filenames from all include/includedefault/includeoptional lines
function extractIncludes(text: string): string[] {
  const results: string[] = [];
  const re = /^\s*include(?:default|optional)?\s+["']?([^\s"'\r\n]+)["']?/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) results.push(m[1]);
  return results;
}

function resolveInclude(filename: string, baseDirs: string[]): string | null {
  for (const dir of baseDirs) {
    const full = path.join(dir, filename);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

// Recursively collect all reachable included files in DFS order (deepest first),
// so that pass1 processes dependencies before their dependents.
function collectIncludes(
  text: string,
  baseDirs: string[],
  out: Array<{ filePath: string; text: string }>,
  visited: Set<string>
): void {
  for (const fname of extractIncludes(text)) {
    const full = resolveInclude(fname, baseDirs);
    if (!full || visited.has(full)) continue;
    visited.add(full);
    try {
      const included = fs.readFileSync(full, 'utf-8');
      collectIncludes(included, baseDirs, out, visited);
      out.push({ filePath: full, text: included });
    } catch { /* unreadable — skip silently */ }
  }
}

export function validateCON(text: string, opts: ValidateOptions = {}): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const syms = new SymbolTable(diagnostics);
  const validator = new Validator(diagnostics, syms);
  const baseDirs = opts.baseDirs ?? [];

  // Collect all reachable included files (DFS, deepest dependency first)
  const included: Array<{ filePath: string; text: string }> = [];
  if (baseDirs.length > 0) {
    collectIncludes(text, baseDirs, included, new Set());
  }

  // Pass 1: build complete symbol table; snapshot deltas per included file
  const deltas: Array<Omit<IncludedFileResult, 'filePath' | 'diagnostics'>> = [];
  for (const inc of included) {
    const gvBefore  = syms.gamevars.size;
    const arrBefore = syms.arrays.size;
    const stBefore  = syms.states.size;
    const defBefore = syms.defines.size;
    const actBefore = syms.actions.size;
    const movBefore = syms.moves.size;
    const aiBefore  = syms.ais.size;
    const qBefore   = syms.quotes.size;
    validator.pass1(inc.text);
    deltas.push({
      gamevarsDelta: syms.gamevars.size - gvBefore,
      arraysDelta:   syms.arrays.size   - arrBefore,
      statesDelta:   syms.states.size   - stBefore,
      definesDelta:  syms.defines.size  - defBefore,
      actionsDelta:  syms.actions.size  - actBefore,
      movesDelta:    syms.moves.size    - movBefore,
      aisDelta:      syms.ais.size      - aiBefore,
      quotesDelta:   syms.quotes.size   - qBefore,
    });
  }
  validator.pass1(text);

  // Pass 2: validate included files; collect per-file diagnostics
  const includedFiles: IncludedFileResult[] = [];
  for (let i = 0; i < included.length; i++) {
    const inc = included[i];
    const tempDiag: Diagnostic[] = [];
    const tempV = new Validator(tempDiag, syms);
    tempV.pass2(inc.text);
    for (const d of tempDiag) diagnostics.push({ ...d, file: inc.filePath });
    includedFiles.push({ filePath: inc.filePath, diagnostics: tempDiag, ...deltas[i] });
  }

  // Pass 2: validate main file (diagnostics have no `file` — caller knows the path)
  validator.pass2(text);

  return {
    diagnostics,
    symbolTable: syms,
    ok: !diagnostics.some(d => d.severity === 'error'),
    includedFiles,
  };
}
