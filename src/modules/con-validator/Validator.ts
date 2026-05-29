import { Tokenizer, Token, TokenKind } from './Tokenizer';
import { SymbolTable } from './SymbolTable';
import { KEYWORDS, KeywordMeta } from './data/keywords';
import { EVENT_NAMES } from './data/events';
import { STRUCT_FIELD_MAP } from './data/structFields';
import { LIMITS }     from './data/builtinSymbols';
import { Diagnostic } from './index';

interface BlockFrame {
  opener: string;    // 'defstate' | 'actor' | 'appendevent' | 'onevent' | 'switch' | '{'
  closer: string;    // expected closer
  isLoop: boolean;
  line: number;
}

// Regex to match CON struct accessor tokens emitted by TypeCON:
// e.g. "geta[ri].x"  "gettiledata[sprite[].picnum].ysize"
// Uses greedy .* for the subscript so nested brackets are handled correctly.
// Groups: (1) op-prefix  (2) struct-op  (3) field (no dots or brackets)
const STRUCT_ACCESSOR_RE = /^(get|set)([a-z]+)\[.*\]\.([^.\[\]]+)$/i;

export class Validator {
  private diag: Diagnostic[];
  private syms: SymbolTable;
  private _pendingLoop = false;  // set by loop keywords; consumed by the next '{'

  constructor(diagnostics: Diagnostic[], symbolTable: SymbolTable) {
    this.diag = diagnostics;
    this.syms = symbolTable;
  }

  // ─── Pass 1: collect all declarations ─────────────────────────────────────

  pass1(text: string): void {
    const tok = new Tokenizer(text);
    // Track block nesting so we can distinguish top-level `state name ... ends`
    // (declaration) from `state name` inside a block (call).
    let depth = 0;
    let t = tok.next();
    while (t.kind !== 'eof') {
      const lower = t.value.toLowerCase();

      if (lower === 'gamevar') {
        const name = tok.next();
        tok.next(); // default value
        // Consume optional flags (integers / identifiers until next keyword)
        let flags = 0;
        while (tok.peek().kind !== 'eof') {
          const pk = tok.peek();
          if (pk.kind === 'keyword') break;
          if (pk.kind === 'integer') flags |= parseInt(pk.value);
          tok.next();
        }
        if (name.kind === 'identifier') this.syms.declareGamevar(name.value, flags, name.line);

      } else if (lower === 'gamearray') {
        const name = tok.next();
        const size = tok.next();
        let flags = 0;
        while (tok.peek().kind !== 'eof') {
          const pk = tok.peek();
          if (pk.kind === 'keyword') break;
          if (pk.kind === 'integer') flags |= parseInt(pk.value);
          tok.next();
        }
        if (name.kind === 'identifier')
          this.syms.declareArray(name.value, Number(size.value) || 0, flags, name.line);

      } else if (lower === 'define') {
        const name = tok.next();
        const val  = tok.next();
        if (name.kind === 'identifier') {
          const n = parseInt(val.value);
          this.syms.defines.set(name.value, isNaN(n) ? 0 : n);
        }

      } else if (lower === 'defstate' || lower === 'appendstate' || lower === 'prependstate') {
        const name = tok.next();
        if (name.kind === 'identifier') this.syms.declareState(name.value, name.line);
        depth++;

      } else if (lower === 'state' && depth === 0) {
        // Top-level `state name ... ends` — old-style state declaration (same as defstate)
        const name = tok.next();
        if (name.kind === 'identifier') this.syms.declareState(name.value, name.line);
        depth++;

      } else if (lower === 'action') {
        const name = tok.next();
        if (name.kind === 'identifier') this.syms.actions.add(name.value);

      } else if (lower === 'move') {
        const name = tok.next();
        if (name.kind === 'identifier') this.syms.moves.add(name.value);

      } else if (lower === 'ai') {
        const name = tok.next();
        if (name.kind === 'identifier') this.syms.ais.add(name.value);

      } else if (lower === 'definequote' || lower === 'redefinequote') {
        const idxToken = tok.next();
        const idx = parseInt(idxToken.value);
        if (!isNaN(idx)) this.syms.defineQuote(idx, idxToken.line);
        tok.skipLineRemainder();

      } else if (lower === 'actor' || lower === 'useractor') {
        if (lower === 'useractor') tok.next(); // enemy-type param
        const tileToken = tok.next();
        const tileId = parseInt(tileToken.value);
        if (!isNaN(tileId)) this.syms.actors.set(tileId, tileToken.line);
        depth++;

      } else if (lower === 'onevent' || lower === 'appendevent') {
        tok.next(); // event name
        depth++;

      } else if (lower === '{' || lower === 'switch') {
        depth++;

      } else if (lower === 'ends' || lower === 'enda' || lower === 'endevent'
               || lower === 'endswitch' || lower === '}') {
        if (depth > 0) depth--;

      } else {
        // For directives whose remainder is free text (e.g. definequote N <text>),
        // skip to EOL so keyword-like words in the text don't affect depth tracking.
        const meta = KEYWORDS.get(lower);
        if (meta?.consumesRestOfLine) tok.skipLineRemainder();
      }

      t = tok.next();
    }
  }

  // ─── Pass 2: structural + reference validation ─────────────────────────────

  pass2(text: string): void {
    const tok = new Tokenizer(text);
    const blockStack: BlockFrame[] = [];

    const isInsideLoop = () => blockStack.some(f => f.isLoop);
    const depth = () => blockStack.length;

    let t = tok.next();
    while (t.kind !== 'eof') {
      this._validateToken(t, tok, blockStack);
      t = tok.next();
    }

    // Unclosed blocks
    for (const frame of blockStack) {
      this.diag.push({ severity: 'error', line: frame.line, col: 0,
        code: 'ERROR_MISSING_CLOSER',
        message: `'${frame.opener}' block opened at line ${frame.line} was never closed with '${frame.closer}'` });
    }
  }

  private _validateToken(t: Token, tok: Tokenizer, stack: BlockFrame[]): void {
    const lower = t.value.toLowerCase();
    const meta  = KEYWORDS.get(lower);

    // ── struct accessor token (e.g. geta[ri].x) ──────────────────────────────
    const m = t.value.match(STRUCT_ACCESSOR_RE);
    if (m) {
      const op    = m[2].toLowerCase();
      const field = m[3].toLowerCase();
      const fields = STRUCT_FIELD_MAP[op];
      if (fields && !fields.has(field)) {
        this.diag.push({ severity: 'error', line: t.line, col: t.col,
          code: 'ERROR_NOTAMEMBER',
          message: `'${field}' is not a valid field for '${op}' struct accessor` });
      }
      return;
    }

    if (!meta) return; // identifier / integer / etc. — no keyword validation needed

    // ── directives whose remainder is free text (e.g. definequote N <text>) ──
    if (meta.consumesRestOfLine) { tok.skipLineRemainder(); return; }

    // ── loop marker (not a block opener — marks next '{' as the loop block) ──
    if (meta.isLoop && !meta.isBlockOpener) {
      this._pendingLoop = true;
      return;
    }

    // ── top-level-only keywords inside a block ───────────────────────────────
    if (meta.topLevelOnly && stack.length > 0) {
      this.diag.push({ severity: 'error', line: t.line, col: t.col,
        code: 'ERROR_FOUNDWITHIN',
        message: `'${lower}' must appear at the top level, not inside a '${stack[stack.length - 1].opener}' block` });
    }

    // ── block openers ─────────────────────────────────────────────────────────
    if (meta.isBlockOpener) {
      const closer = lower === '{' ? '}' : (meta.blockCloser ?? 'ends');
      const isLoop = !!meta.isLoop || this._pendingLoop;
      this._pendingLoop = false;

      // For appendevent/onevent: validate event name
      if (meta.takesEventName) {
        const evToken = tok.peek();
        const evName = evToken.value;
        if (!EVENT_NAMES.has(evName)) {
          this.diag.push({ severity: 'error', line: evToken.line, col: evToken.col,
            code: 'ERROR_UNKNOWN_EVENT',
            message: `Unknown event '${evName}'. Expected one of the 172 EDuke32 EVENT_* names` });
        }
      }

      // For actor/useractor: validate tile ID range
      if (lower === 'actor' || lower === 'useractor') {
        if (lower === 'useractor') tok.next(); // skip enemy-type argument
        const tileToken = tok.peek();
        if (tileToken.kind === 'integer') {
          const id = parseInt(tileToken.value);
          if (id < 0 || id >= LIMITS.MAXTILES) {
            this.diag.push({ severity: 'error', line: tileToken.line, col: tileToken.col,
              code: 'ERROR_EXCEEDSMAXTILES',
              message: `Actor tile ID ${id} out of range [0, ${LIMITS.MAXTILES - 1}]` });
          }
        }
      }

      stack.push({ opener: lower, closer, isLoop, line: t.line });
      return;
    }

    // ── block closers ─────────────────────────────────────────────────────────
    if (meta.isBlockCloser) {
      this._pendingLoop = false;
      if (stack.length === 0) {
        this.diag.push({ severity: 'error', line: t.line, col: t.col,
          code: 'ERROR_NOTTOPLEVEL',
          message: `Unexpected '${lower}' — no matching block opener` });
        return;
      }
      const frame = stack[stack.length - 1];
      if (frame.closer !== lower) {
        this.diag.push({ severity: 'error', line: t.line, col: t.col,
          code: 'ERROR_MISMATCHED_CLOSER',
          message: `Expected '${frame.closer}' to close '${frame.opener}' (opened at line ${frame.line}), got '${lower}'` });
      }
      stack.pop();
      return;
    }

    // ── continue — loop scope only ────────────────────────────────────────────
    if (meta.loopOnly) {
      const inLoop = stack.some(f => f.isLoop);
      if (!inLoop) {
        this.diag.push({ severity: 'error', line: t.line, col: t.col,
          code: 'ERROR_CONTINUE_OUTSIDE_LOOP',
          message: `'${lower}' used outside of a loop` });
      }
      return;
    }

    // ── break — valid anywhere inside a block (CON uses it as early exit too) ─
    if (meta.breakable) {
      if (stack.length === 0) {
        this.diag.push({ severity: 'error', line: t.line, col: t.col,
          code: 'ERROR_BREAK_OUTSIDE_BLOCK',
          message: `'${lower}' used outside of any block` });
      }
      return;
    }

    // ── state keyword — declaration at top level, call inside a block ─────────
    if (lower === 'state') {
      if (stack.length === 0) {
        // Top-level: `state name ... ends` is an old-style state declaration
        stack.push({ opener: 'state', closer: 'ends', isLoop: false, line: t.line });
      } else {
        // Inside a block: call a previously declared state
        const nameToken = tok.peek();
        if (nameToken.kind === 'identifier') {
          if (!this.syms.isKnownState(nameToken.value)) {
            this.diag.push({ severity: 'warning', line: nameToken.line, col: nameToken.col,
              code: 'WARNING_UNKNOWN_STATE',
              message: `State '${nameToken.value}' referenced but not declared in this file (may be in a linked module)` });
          }
        }
      }
    }
  }
}
