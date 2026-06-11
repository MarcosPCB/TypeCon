import { Operand, Statement, ConditionalOp } from './Types';
import * as fs from 'fs';
import * as path from 'path';

interface Token { value: string; line: number; }

// Preprocess CON source into a flat token list, stripping comments.
// Block comments are replaced with spaces to preserve line numbers.
interface TokenizeResult { toks: Token[]; rawLines: string[]; }

function tokenize(source: string): TokenizeResult {
  // Strip /* ... */ block comments (preserve newlines for line counting)
  let s = source.replace(/\/\*[\s\S]*?\*\//g, m =>
    m.replace(/[^\n]/g, ' ')
  );

  const toks: Token[] = [];
  const rawLines: string[] = [];
  const lines = s.split('\n');
  for (let ln = 0; ln < lines.length; ln++) {
    const raw = lines[ln];
    // Preserve //// DEBUG-TEST //// style markers before stripping comments
    const trimmed = raw.trim();
    if (trimmed.startsWith('////')) {
      const markerContent = trimmed.replace(/^\/+\s*/, '').replace(/\s*\/+$/, '').trim();
      toks.push({ value: `__marker__:${markerContent}`, line: ln + 1 });
      rawLines.push('');
      continue;
    }
    // Strip // line comments
    const ci = raw.indexOf('//');
    const clean = ci >= 0 ? raw.substring(0, ci) : raw;
    rawLines.push(clean);
    for (const tok of clean.split(/\s+/)) {
      if (tok.length > 0) toks.push({ value: tok, line: ln + 1 });
    }
  }
  return { toks, rawLines };
}

export interface ActorHeader {
  extra: number;          // initial sprite.extra value (0 = none)
  firstAction: string | null;  // action label name, null if not set
  firstMove: string | null;    // move label name, null if not set
  flags: number;          // actor spawn flags
}

export interface ParseResult {
  stateMap: Map<string, Statement[]>;
  defines: Map<string, number>;
  initStatements: Statement[];
  eventBodies: Map<string, Statement[]>; // EVENT_Name → concatenated body (all handlers)
  actorBodies: Map<string, Statement[]>; // picnum string → actor/useractor body
  actorHeaders: Map<string, ActorHeader>; // picnum string → actor header values
}

// Set of conditional opcodes for fast lookup
const CONDITIONALS = new Set<string>([
  'ifvarl','ifvarle','ifvare','ifvarn','ifvarg','ifvarge','ifvarand','ifvaror',
  'ifl','ifle','ife','ifn','ifg','ifge','ifand','ifor','ifeither',
]);

// CON keywords that signal the start of a new top-level block/statement.
// Used by the unknown-token skipper to stop consuming args.
const TOP_KEYWORDS = new Set<string>([
  'defstate','ends','actor','useractor','enda','onevent','appendevent','on','endevent',
  'gamevar','gamearray','define','definequote','string','include',
  'state','set','add','sub','mul','div','mod','and','or','xor','shiftl','shiftr','abs','inv','clamp','divr',
  'sin','cos','sqrt','mulscale','divscale','setarray','getarraysize','resizearray','copy','setarrayseq','getarrayseq',
  'ifvarl','ifvarle','ifvare','ifvarn','ifvarg','ifvarge','ifvarand','ifvaror',
  'ifl','ifle','ife','ifn','ifg','ifge','ifand','ifor','ifeither',
  'ifhitweapon',
  'readarrayfromfile','writearraytofile',
  'whilevarn','whilevarl','whilel','whilen','switch','endswitch','case','default','else',
  'break','continue','terminate','exit','return','debug','nullop','noop',
  'qputs','qstrcpy','qstrcat','qstrncat','qsprintf','sqprintf','qsubstr','qgetsysstr',
  'quote','userquote','echo','addlogvar','al',
]);

class CONScanner {
  private toks: Token[];
  private rawLines: string[];
  private pos = 0;

  constructor(source: string) {
    const result = tokenize(source);
    this.toks = result.toks;
    this.rawLines = result.rawLines;
  }

  peek(): string | null {
    return this.pos < this.toks.length ? this.toks[this.pos].value : null;
  }

  next(): string | null {
    return this.pos < this.toks.length ? this.toks[this.pos++].value : null;
  }

  currentLine(): number {
    return this.pos > 0 ? this.toks[this.pos - 1].line : 1;
  }

  peekLine(): number {
    return this.pos < this.toks.length ? this.toks[this.pos].line : -1;
  }

  // Return raw text remainder of the last consumed token's line, after that token.
  // Preserves whitespace — needed for string/definequote where the text may be a single space.
  rawRestOfLine(): string {
    if (this.pos === 0) return '';
    const lastTok = this.toks[this.pos - 1];
    const lineText = this.rawLines[lastTok.line - 1] ?? '';
    // Find where the token ends in the raw line text
    const tokIdx = lineText.indexOf(lastTok.value);
    const afterTok = tokIdx >= 0 ? lineText.substring(tokIdx + lastTok.value.length) : '';
    // Advance scanner past all tokens on this line
    while (this.pos < this.toks.length && this.toks[this.pos].line === lastTok.line) {
      this.pos++;
    }
    return afterTok;
  }

  // Consume all remaining tokens on the current line (after already consuming one token)
  restOfLine(): string {
    const line = this.currentLine();
    const parts: string[] = [];
    while (this.pos < this.toks.length && this.toks[this.pos].line === line) {
      parts.push(this.toks[this.pos++].value);
    }
    return parts.join(' ');
  }

  eof(): boolean {
    return this.pos >= this.toks.length;
  }
}

function parseOperand(tok: string, defines: Map<string, number>): Operand {
  if (!tok) return { kind: 'immediate', value: 0 };

  // Hex literal
  if (tok.startsWith('0x') || tok.startsWith('0X'))
    return { kind: 'immediate', value: parseInt(tok, 16) | 0 };

  // Array access: name[index]  (flat[rsp], flat[0], etc.)
  const m = tok.match(/^(\w+)\[(.+)]$/);
  if (m) return { kind: 'array', name: m[1], index: parseOperand(m[2], defines) };

  // Numeric literal (including negative)
  const n = Number(tok);
  if (!isNaN(n) && tok !== '') {
    if (!Number.isInteger(n))
      throw new Error(`[CONVM] Float literal '${tok}' in CON source — CON only accepts integers. Run the compiler to convert float literals to fixed-point.`);
    return { kind: 'immediate', value: n | 0 };
  }

  // Define constant
  const d = defines.get(tok);
  if (d !== undefined) return { kind: 'immediate', value: d };

  return { kind: 'var', name: tok };
}

export class CONParser {
  private sc: CONScanner;
  private defines: Map<string, number>;
  private stateMap: Map<string, Statement[]>;
  private eventBodies: Map<string, Statement[]>;
  private actorBodies: Map<string, Statement[]>;
  private actorHeaders: Map<string, ActorHeader>;
  private searchDirs: string[];
  private visited: Set<string>;

  constructor(
    source: string,
    searchDirs: string[] = [],
    // Shared maps allow recursive includes to write into the same collections
    shared?: {
      defines: Map<string, number>;
      stateMap: Map<string, Statement[]>;
      eventBodies: Map<string, Statement[]>;
      actorBodies: Map<string, Statement[]>;
      actorHeaders: Map<string, ActorHeader>;
      visited: Set<string>;
    }
  ) {
    this.sc = new CONScanner(source);
    this.searchDirs = searchDirs;
    if (shared) {
      this.defines      = shared.defines;
      this.stateMap     = shared.stateMap;
      this.eventBodies  = shared.eventBodies;
      this.actorBodies  = shared.actorBodies;
      this.actorHeaders = shared.actorHeaders;
      this.visited      = shared.visited;
    } else {
      this.defines      = new Map();
      this.stateMap     = new Map();
      this.eventBodies  = new Map();
      this.actorBodies  = new Map();
      this.actorHeaders = new Map();
      this.visited      = new Set();
    }
  }

  parse(): ParseResult {
    const initStatements: Statement[] = [];

    while (!this.sc.eof()) {
      const tok = this.sc.peek();
      if (!tok) break;

      const low = tok.toLowerCase();

      if (low === 'defstate' || low === 'state') {
        // 'state NAME ... ends' is the old-style defstate declaration used in real
        // Duke3D CON files (e.g. baseCON/GAME.CON). Treat identically to defstate.
        this.parseDefstate();
      } else if (low === 'appendstate' || low === 'prependstate') {
        this.parseAppendstate(low === 'prependstate');
      } else if (low === 'gamevar' || low === 'var') {
        const stmt = this.parseGamevar();
        if (stmt) initStatements.push(stmt);
      } else if (low === 'gamearray' || low === 'array') {
        const stmt = this.parseGamearray();
        if (stmt) initStatements.push(stmt);
      } else if (low === 'define') {
        this.parseDefine();
      } else if (low === 'definequote' || low === 'string') {
        const stmt = this.parseDefinequote();
        if (stmt) initStatements.push(stmt);
      } else if (low === 'actor' || low === 'useractor') {
        this.parseActor();
      } else if (low === 'onevent' || low === 'on') {
        this.parseEventBlock(true);   // onevent/on → prepend (runs before appendevent)
      } else if (low === 'appendevent') {
        this.parseEventBlock(false);  // appendevent → append
      } else if (low === 'include') {
        this.sc.next(); // 'include'
        const raw = this.sc.next() ?? ''; // filename (may be quoted)
        const filename = raw.replace(/^["']|["']$/g, '');
        this.parseInclude(filename, initStatements);
      } else {
        const stmt = this.parseStatement();
        if (stmt && stmt.op !== 'noop' && stmt.op !== 'nullop') {
          initStatements.push(stmt);
        }
      }
    }

    return { stateMap: this.stateMap, defines: this.defines, initStatements, eventBodies: this.eventBodies, actorBodies: this.actorBodies, actorHeaders: this.actorHeaders };
  }

  private parseDefstate(): void {
    this.sc.next(); // 'defstate'
    const name = this.sc.next() ?? '__unnamed';
    const body: Statement[] = [];
    while (!this.sc.eof() && this.sc.peek()?.toLowerCase() !== 'ends') {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    this.sc.next(); // 'ends'
    this.stateMap.set(name, body);
  }

  private parseAppendstate(prepend: boolean): void {
    this.sc.next(); // 'appendstate' or 'prependstate'
    const name = this.sc.next() ?? '__unnamed';
    const extra: Statement[] = [];
    while (!this.sc.eof() && this.sc.peek()?.toLowerCase() !== 'ends') {
      const stmt = this.parseStatement();
      if (stmt) extra.push(stmt);
    }
    this.sc.next(); // 'ends'
    const existing = this.stateMap.get(name) ?? [];
    this.stateMap.set(name, prepend ? [...extra, ...existing] : [...existing, ...extra]);
  }

  private parseGamevar(): Statement | null {
    this.sc.next(); // 'gamevar' / 'var'
    const name = this.sc.next()!;
    const initTok = this.sc.next() ?? '0';
    const init = this.resolveLiteral(initTok);
    // FLAGS: skip if next token looks like a flag (number or REG_* identifier)
    const nextTok = this.sc.peek();
    if (nextTok !== null && (/^\d+$/.test(nextTok) || nextTok.toUpperCase().startsWith('REG_') || nextTok.toUpperCase().startsWith('GAMEVAR'))) {
      this.sc.next();
    }
    // Store initial value; interpreter reads 0 by default, so only store non-zero
    if (init !== 0) {
      this.stateMap.set(`__var_${name}`, [
        { op: 'set', dst: { kind: 'var', name }, src: { kind: 'immediate', value: init } }
      ]);
    }
    return null;
  }

  private parseGamearray(): Statement | null {
    this.sc.next(); // 'gamearray' / 'array'
    const name = this.sc.next()!;
    const sizeTok = this.sc.next() ?? '0';
    const size = this.resolveLiteral(sizeTok);
    // FLAGS is optional (0 or 1); skip only if the next token looks like a flag
    const nextTok = this.sc.peek();
    if (nextTok !== null && (nextTok === '0' || nextTok === '1' || nextTok.toUpperCase().startsWith('GAMEARRAY'))) {
      this.sc.next();
    }
    // We store array declarations for the interpreter to initialize
    this.stateMap.set(`__array_${name}`, [
      { op: 'resizearray', arr: name, size: { kind: 'immediate', value: size } }
    ]);
    return null;
  }

  private parseDefine(): void {
    this.sc.next(); // 'define'
    const name = this.sc.next()!;
    const valTok = this.sc.next() ?? '0';
    const value = this.resolveLiteral(valTok);
    this.defines.set(name, value);
  }

  private parseDefinequote(): Statement | null {
    this.sc.next(); // 'definequote' or 'string'
    const idxTok = this.sc.next()!;
    const idx = this.resolveLiteral(idxTok);
    // Use raw remainder to preserve whitespace (e.g. `string 900  ` = single space)
    const raw = this.sc.rawRestOfLine();
    // Strip one leading space (separator between index and content), then strip surrounding quotes
    const text = raw.replace(/^ /, '').replace(/^["']|["']$/g, '');
    return { op: 'qputs', quote: { kind: 'immediate', value: idx }, text };
  }

  private parseEventBlock(prepend: boolean): void {
    this.sc.next(); // 'appendevent' / 'onevent' / 'on'
    const eventName = this.sc.next() ?? ''; // e.g. EVENT_InitComplete
    const body: Statement[] = [];
    while (!this.sc.eof() && this.sc.peek()?.toLowerCase() !== 'endevent') {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    this.sc.next(); // 'endevent'
    const key = eventName.toUpperCase();
    const existing = this.eventBodies.get(key) ?? [];
    // onevent/on prepend so they always run before appendevent bodies;
    // appendevent appends to maintain declaration order within each group.
    this.eventBodies.set(key, prepend ? [...body, ...existing] : [...existing, ...body]);
  }

  private parseActor(): void {
    const keyword = this.sc.next()!.toLowerCase(); // 'actor' or 'useractor'
    let picnum: string;
    if (keyword === 'useractor') {
      this.sc.next(); // ENEMY flag (0=notenemy,1=enemy,2=enemystayput) — skip
      picnum = this.sc.next() ?? '0'; // PICNUM is the 2nd arg
    } else {
      picnum = this.sc.next() ?? '0'; // PICNUM is the 1st arg for 'actor'
    }
    // Parse optional header tokens on the same line: EXTRA FIRSTACTION FIRSTMOVE FLAGS
    const headerLine = this.sc.currentLine();
    const headerToks: string[] = [];
    while (!this.sc.eof() && this.sc.peekLine() === headerLine) {
      headerToks.push(this.sc.next()!);
    }
    const extra = this.resolveLiteral(headerToks[0] ?? '0');
    const firstAction = (headerToks[1] && headerToks[1] !== '0') ? headerToks[1] : null;
    const firstMove   = (headerToks[2] && headerToks[2] !== '0') ? headerToks[2] : null;
    const flags = this.resolveLiteral(headerToks[3] ?? '0');
    this.actorHeaders.set(picnum, { extra, firstAction, firstMove, flags });

    const body: Statement[] = [];
    while (!this.sc.eof() && this.sc.peek()?.toLowerCase() !== 'enda') {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    this.sc.next(); // 'enda'
    // Last definition for a picnum wins (matches EDuke32 behaviour)
    this.actorBodies.set(picnum, body);
  }

  private parseInclude(filename: string, initStatements: Statement[]): void {
    if (!filename || this.searchDirs.length === 0) return;
    // Search each directory in order (CON file dir first, then fallbacks like baseCON)
    let resolved: string | null = null;
    for (const dir of this.searchDirs) {
      const candidate = path.resolve(dir, filename);
      if (fs.existsSync(candidate)) { resolved = candidate; break; }
    }
    if (!resolved) {
      console.warn(`[CONVM] WARNING: include file not found: ${filename} (searched: ${this.searchDirs.join(', ')})`);
      return;
    }
    if (this.visited.has(resolved)) return; // prevent circular includes
    let source: string;
    try {
      source = fs.readFileSync(resolved, 'utf-8');
    } catch {
      console.warn(`[CONVM] WARNING: could not read include file: ${resolved}`);
      return;
    }
    this.visited.add(resolved);
    // Child inherits the same searchDirs so recursive includes (e.g. GAME.CON → DEFS.CON) resolve too
    const child = new CONParser(source, this.searchDirs, {
      defines: this.defines,
      stateMap: this.stateMap,
      eventBodies: this.eventBodies,
      actorBodies: this.actorBodies,
      actorHeaders: this.actorHeaders,
      visited: this.visited,
    });
    const childResult = child.parse();
    initStatements.push(...childResult.initStatements);
  }

  private skipUntil(endKeyword: string): void {
    this.sc.next(); // opening keyword
    while (!this.sc.eof()) {
      const t = this.sc.next();
      if (t?.toLowerCase() === endKeyword) break;
    }
  }

  private parseBody(): Statement[] {
    if (this.sc.peek() === '{') {
      this.sc.next(); // '{'
      const stmts: Statement[] = [];
      while (!this.sc.eof() && this.sc.peek() !== '}') {
        const stmt = this.parseStatement();
        if (stmt) stmts.push(stmt);
      }
      this.sc.next(); // '}'
      return stmts;
    }
    // Single statement
    const stmt = this.parseStatement();
    return stmt ? [stmt] : [];
  }

  private parseStatement(): Statement {
    const tok = this.sc.peek();
    if (!tok) return { op: 'noop' };

    // Debug marker tokens emitted by the tokenizer for //// ... //// lines
    if (tok.startsWith('__marker__:')) {
      this.sc.next();
      return { op: 'marker', name: tok.slice(11) };
    }

    const low = tok.toLowerCase();

    // Per-actor variable access: getactorvar[INDEX]._pCptr DST  /  setactorvar[INDEX]._pCptr SRC
    const actorVarRe = /^(getactorvar|setactorvar)\[([^\]]*)\]\.(\w+)$/i;
    const actorVarMatch = tok.match(actorVarRe);
    if (actorVarMatch) {
      this.sc.next();
      const [, opcode, idxStr, field] = actorVarMatch;
      const isGet = opcode.toLowerCase().startsWith('get');
      const index = parseOperand(idxStr === '' ? 'THISACTOR' : idxStr, this.defines);
      const reg = this.parseOperand();
      if (isGet) return { op: 'getactorvar', index, field, dst: reg };
      else        return { op: 'setactorvar', index, field, src: reg };
    }

    // for VAR allsprites { body } — iterate over all active sprite indices
    if (low === 'for') {
      this.sc.next();
      const loopVar = this.sc.next()!;
      const iterator = this.sc.next()!; // e.g. 'allsprites'
      // consume iterator keyword — only allsprites is supported in the VM currently
      const body = this.parseBody();
      return { op: 'for_allsprites', loopVar, body };
    }

    // Game structure access: geta[INDEX].FIELD DST  /  seta[INDEX].FIELD SRC  etc.
    const structRe = /^(geta|seta|getp|setp|getsector|setsector|getwall|setwall)\[([^\]]*)\]\.(\w+)$/i;
    const structMatch = tok.match(structRe);
    if (structMatch) {
      this.sc.next(); // consume the compound token
      const [, opcode, idxStr, field] = structMatch;
      const isGet = opcode.toLowerCase().startsWith('get');
      const structNames: Record<string, 'actor' | 'player' | 'sector' | 'wall'> = {
        geta: 'actor', seta: 'actor',
        getp: 'player', setp: 'player',
        getsector: 'sector', setsector: 'sector',
        getwall: 'wall', setwall: 'wall',
      };
      const struct = structNames[opcode.toLowerCase()];
      const index = parseOperand(idxStr === '' ? 'THISACTOR' : idxStr, this.defines);
      const reg = this.parseOperand();
      if (isGet) return { op: 'getstruct', struct, index, field, dst: reg };
      else        return { op: 'setstruct', struct, index, field, src: reg };
    }

    // Arithmetic binary ops
    if (['set','add','sub','mul','div','mod','and','or','xor','shiftl','shiftr','divr'].includes(low)) {
      const op = this.sc.next()! as 'set';
      const dst = this.parseOperand();
      const src = this.parseOperand();
      return { op: op as any, dst, src };
    }

    if (low === 'abs' || low === 'inv') {
      const op = this.sc.next()! as 'abs' | 'inv';
      return { op, dst: this.parseOperand() };
    }

    if (low === 'clamp') {
      this.sc.next();
      const dst = this.parseOperand();
      const min = this.parseOperand();
      const max = this.parseOperand();
      return { op: 'clamp', dst, min, max };
    }

    // Math ops
    if (low === 'sin' || low === 'cos') {
      const op = this.sc.next()! as 'sin' | 'cos';
      const dst = this.parseOperand();
      const src = this.parseOperand();
      return { op, dst, src };
    }

    if (low === 'sqrt') {
      this.sc.next();
      const src = this.parseOperand(); // CON: sqrt SRC DST
      const dst = this.parseOperand();
      return { op: 'sqrt', dst, src };
    }

    if (low === 'getangle') {
      this.sc.next();
      const dst = this.parseOperand();
      const dx  = this.parseOperand();
      const dy  = this.parseOperand();
      return { op: 'getangle', dst, dx, dy };
    }

    if (low === 'mulscale') {
      this.sc.next();
      const dst = this.parseOperand();
      const a = this.parseOperand();
      const b = this.parseOperand();
      const scale = this.parseOperand();
      return { op: 'mulscale', dst, a, b, scale };
    }

    if (low === 'divscale') {
      this.sc.next();
      const dst = this.parseOperand();
      const a = this.parseOperand();
      const b = this.parseOperand();
      const scale = this.parseOperand();
      return { op: 'divscale', dst, a, b, scale };
    }

    // Array ops
    if (low === 'setarray') {
      this.sc.next();
      const arr = this.parseOperand();
      const val = this.parseOperand();
      return { op: 'setarray', arr, val };
    }

    if (low === 'getarraysize') {
      this.sc.next();
      // CON syntax: getarraysize ARRAY DESTINATION (array first, dest second)
      const arr = this.sc.next() ?? 'flat';
      const dst = this.parseOperand();
      return { op: 'getarraysize', dst, arr };
    }

    if (low === 'resizearray') {
      this.sc.next();
      const arr = this.sc.next() ?? 'flat';
      const size = this.parseOperand();
      return { op: 'resizearray', arr, size };
    }

    if (low === 'readarrayfromfile' || low === 'writearraytofile') {
      const op = this.sc.next()! as 'readarrayfromfile' | 'writearraytofile';
      const arr = this.sc.next() ?? 'flat';
      const quote = this.parseOperand();
      return { op, arr, quote };
    }

    if (low === 'copy') {
      this.sc.next();
      // Accepts both `copy DST DSTIDX SRC SRCIDX COUNT` and `copy DST[DSTIDX] SRC[SRCIDX] COUNT`
      const dstTok = this.sc.next()!;
      const dstM = dstTok.match(/^(\w+)\[(.+)]$/);
      let dst: string, dstIdx: Operand;
      if (dstM) {
        dst = dstM[1]; dstIdx = parseOperand(dstM[2], this.defines);
      } else {
        dst = dstTok; dstIdx = this.parseOperand();
      }
      const srcTok = this.sc.next()!;
      const srcM = srcTok.match(/^(\w+)\[(.+)]$/);
      let src: string, srcIdx: Operand;
      if (srcM) {
        src = srcM[1]; srcIdx = parseOperand(srcM[2], this.defines);
      } else {
        src = srcTok; srcIdx = this.parseOperand();
      }
      const count = this.parseOperand();
      // CON copy: copy SRC[SRCIDX] DST[DSTIDX] COUNT  (first arg = source)
      return { op: 'copy', src: dst, srcIdx: dstIdx, dst: src, dstIdx: srcIdx, count };
    }

    if (low === 'setarrayseq') {
      this.sc.next();
      const arr = this.sc.next()!;
      const vars: string[] = [];
      const line = this.sc.currentLine();
      while (!this.sc.eof() && this.sc.peekLine() === line) {
        vars.push(this.sc.next()!);
      }
      return { op: 'setarrayseq', arr, vars };
    }

    if (low === 'getarrayseq') {
      this.sc.next();
      const arr = this.sc.next()!;
      const vars: string[] = [];
      const line = this.sc.currentLine();
      while (!this.sc.eof() && this.sc.peekLine() === line) {
        vars.push(this.sc.next()!);
      }
      return { op: 'getarrayseq', arr, vars };
    }

    // State call
    if (low === 'state') {
      this.sc.next();
      const name = this.sc.next() ?? '';
      return { op: 'state', name };
    }

    // Conditionals (with optional else branch)
    if (CONDITIONALS.has(low)) {
      const op = this.sc.next()! as ConditionalOp;
      const a = this.parseOperand();
      const b = this.parseOperand();
      const body = this.parseBody();
      let elseBody: Statement[] | undefined;
      if (this.sc.peek()?.toLowerCase() === 'else') {
        this.sc.next();
        elseBody = this.parseBody();
      }
      return { op, a, b, body, elseBody };
    }

    // ifhitweapon — no operands; applies damage (htextra → extra) then tests hit
    if (low === 'ifhitweapon') {
      this.sc.next();
      const body = this.parseBody();
      let elseBody: Statement[] | undefined;
      if (this.sc.peek()?.toLowerCase() === 'else') {
        this.sc.next();
        elseBody = this.parseBody();
      }
      return { op: 'ifhitweapon', body, elseBody };
    }

    // While loops
    if (low === 'whilevarn' || low === 'whilevarl' || low === 'whilel' || low === 'whilen') {
      this.sc.next();
      const a = this.parseOperand();
      const b = this.parseOperand();
      const body = this.parseBody();
      // whilen = while a != b (same as whilevarn)
      const op = (low === 'whilevarn' || low === 'whilen') ? 'whilevarn' : 'whilevarl';
      return { op, a, b, body };
    }

    // Switch
    if (low === 'switch') {
      this.sc.next();
      const val = this.parseOperand();
      // expect {
      if (this.sc.peek() === '{') this.sc.next();
      const cases: { value: number; body: Statement[] }[] = [];
      let defaultBody: Statement[] | undefined;

      // Support both brace-style { } and old-style endswitch terminators
      while (!this.sc.eof() && this.sc.peek() !== '}' && this.sc.peek()?.toLowerCase() !== 'endswitch') {
        const t = this.sc.peek()?.toLowerCase();
        if (t === 'case') {
          this.sc.next();
          const rawCaseTok = (this.sc.next() ?? '0').replace(/:$/, ''); // strip glued colon
          const caseVal = this.resolveLiteral(rawCaseTok);
          if (this.sc.peek() === ':') this.sc.next(); // consume ':' if it's a separate token
          const body: Statement[] = [];
          while (!this.sc.eof()) {
            const p = this.sc.peek()?.toLowerCase();
            if (p === 'case' || p === 'default' || p === '}' || p === 'endswitch') break;
            body.push(this.parseStatement());
          }
          cases.push({ value: caseVal, body });
        } else if (t === 'default' || t === 'default:') {
          this.sc.next();
          if (this.sc.peek() === ':') this.sc.next(); // separate colon
          const body: Statement[] = [];
          while (!this.sc.eof()) {
            const p = this.sc.peek()?.toLowerCase();
            if (p === 'case' || p === '}' || p === 'endswitch') break;
            body.push(this.parseStatement());
          }
          defaultBody = body;
        } else {
          this.sc.next(); // skip unknown token in switch
        }
      }
      if (this.sc.peek() === '}' || this.sc.peek()?.toLowerCase() === 'endswitch') this.sc.next();
      return { op: 'switch', val, cases, default: defaultBody };
    }

    // Control flow signals
    if (low === 'break')     { this.sc.next(); return { op: 'break' }; }
    if (low === 'continue')  { this.sc.next(); return { op: 'continue' }; }
    if (low === 'terminate') { this.sc.next(); return { op: 'terminate' }; }
    if (low === 'exit')      { this.sc.next(); return { op: 'exit' }; }
    if (low === 'return')    { this.sc.next(); return { op: 'terminate' }; }  // return = exit defstate
    if (low === 'debug')     { this.sc.next(); this.parseOperand(); return { op: 'noop' }; }
    if (low === 'nullop')    { this.sc.next(); return { op: 'nullop' }; }
    if (low === 'noop')      { this.sc.next(); return { op: 'noop' }; }

    // Quote / string ops
    if (low === 'qputs') {
      this.sc.next();
      const quote = this.parseOperand();
      const text = this.sc.restOfLine().replace(/^["']|["']$/g, '');
      return { op: 'qputs', quote, text };
    }

    if (low === 'qstrcpy' || low === 'qstrcat') {
      const op = this.sc.next()! as 'qstrcpy' | 'qstrcat';
      const dst = this.parseOperand();
      const src = this.parseOperand();
      return { op, dst, src };
    }

    if (low === 'qstrncat') {
      this.sc.next();
      const dst = this.parseOperand();
      const src = this.parseOperand();
      const len = this.parseOperand();
      return { op: 'qstrncat', dst, src, len };
    }

    if (low === 'qsprintf' || low === 'sqprintf') {
      const op = this.sc.next()! as 'qsprintf' | 'sqprintf';
      const dst = this.parseOperand();
      const fmt = this.parseOperand();
      // Read args until end of line or next keyword
      const args: Operand[] = [];
      const line = this.sc.currentLine();
      while (!this.sc.eof() && this.sc.peekLine() === line) {
        const p = this.sc.peek();
        if (!p || TOP_KEYWORDS.has(p.toLowerCase())) break;
        args.push(this.parseOperand());
      }
      return { op, dst, fmt, args };
    }

    if (low === 'qsubstr') {
      this.sc.next();
      const dst = this.parseOperand();
      const src = this.parseOperand();
      const start = this.parseOperand();
      const len = this.parseOperand();
      return { op: 'qsubstr', dst, src, start, len };
    }

    if (low === 'qgetsysstr') {
      this.sc.next();
      const dst = this.parseOperand();
      const src = this.parseOperand();
      return { op: 'qgetsysstr', dst, src };
    }

    if (low === 'quote' || low === 'userquote') {
      const op = this.sc.next()! as 'quote' | 'userquote';
      const quote = this.parseOperand();
      return { op, quote };
    }

    if (low === 'echo') {
      this.sc.next();
      const val = this.parseOperand();
      return { op: 'echo', val };
    }

    if (low === 'addlogvar' || low === 'al') {
      this.sc.next();
      const val = this.parseOperand();
      return { op: 'addlogvar', val };
    }

    // Unknown keyword — skip it and its same-line arguments (heuristic)
    this.sc.next();
    // Consume non-keyword args on the same line
    const line = this.sc.currentLine();
    while (!this.sc.eof() && this.sc.peekLine() === line) {
      const p = this.sc.peek();
      if (!p || TOP_KEYWORDS.has(p.toLowerCase())) break;
      this.sc.next();
    }
    return { op: 'noop' };
  }

  private parseOperand(): Operand {
    const tok = this.sc.next() ?? '0';
    return parseOperand(tok, this.defines);
  }

  private resolveLiteral(tok: string): number {
    if (tok.startsWith('0x') || tok.startsWith('0X')) return parseInt(tok, 16) | 0;
    const n = Number(tok);
    if (!isNaN(n) && tok !== '') return n | 0;
    return this.defines.get(tok) ?? 0;
  }
}
