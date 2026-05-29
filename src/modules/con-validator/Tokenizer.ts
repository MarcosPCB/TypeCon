import { KEYWORDS } from './data/keywords';

export type TokenKind =
  | 'keyword'
  | 'identifier'
  | 'integer'
  | 'lbrace'
  | 'rbrace'
  | 'lbracket'
  | 'rbracket'
  | 'dot'
  | 'eof';

export interface Token {
  kind: TokenKind;
  value: string;
  line: number;
  col: number;
}

const EOF_TOKEN: Token = { kind: 'eof', value: '', line: -1, col: -1 };

// Characters that can appear in a CON identifier/keyword (matches isaltok() in gamedef.cpp)
function isIdentChar(ch: string): boolean {
  return /[A-Za-z0-9_\-\.]/.test(ch);
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
}

export class Tokenizer {
  private text: string;
  private pos: number = 0;
  private line: number = 1;
  private col: number = 1;
  private _peeked: Token | null = null;

  constructor(text: string) {
    this.text = text;
  }

  peek(): Token {
    if (!this._peeked) {
      const saved = { pos: this.pos, line: this.line, col: this.col };
      this._peeked = this._readNext();
      // Don't restore — we'll return the peeked token on next()
    }
    return this._peeked;
  }

  next(): Token {
    if (this._peeked) {
      const t = this._peeked;
      this._peeked = null;
      return t;
    }
    return this._readNext();
  }

  peekValue(): string {
    return this.peek().value;
  }

  peekKind(): TokenKind {
    return this.peek().kind;
  }

  /** Discard the rest of the current line (used after directives like definequote). */
  skipLineRemainder(): void {
    this._peeked = null;
    while (this.pos < this.text.length && this.ch() !== '\n') this.advance();
  }

  private ch(): string {
    return this.pos < this.text.length ? this.text[this.pos] : '';
  }

  private advance(): string {
    const c = this.text[this.pos++];
    if (c === '\n') { this.line++; this.col = 1; }
    else { this.col++; }
    return c;
  }

  private skipWhitespaceAndComments(): void {
    for (;;) {
      // Whitespace
      while (this.pos < this.text.length && isWhitespace(this.ch())) this.advance();
      if (this.pos >= this.text.length) break;

      // Line comment //
      if (this.text[this.pos] === '/' && this.text[this.pos + 1] === '/') {
        while (this.pos < this.text.length && this.ch() !== '\n') this.advance();
        continue;
      }

      // Block comment /* */
      if (this.text[this.pos] === '/' && this.text[this.pos + 1] === '*') {
        this.advance(); this.advance(); // consume /*
        while (this.pos < this.text.length) {
          if (this.text[this.pos] === '*' && this.text[this.pos + 1] === '/') {
            this.advance(); this.advance(); // consume */
            break;
          }
          this.advance();
        }
        continue;
      }

      break;
    }
  }

  private _readNext(): Token {
    this.skipWhitespaceAndComments();

    if (this.pos >= this.text.length) return EOF_TOKEN;

    const startLine = this.line;
    const startCol  = this.col;
    const c = this.ch();

    // Single-char structural tokens
    if (c === '{') { this.advance(); return { kind: 'lbrace',   value: '{', line: startLine, col: startCol }; }
    if (c === '}') { this.advance(); return { kind: 'rbrace',   value: '}', line: startLine, col: startCol }; }
    if (c === '[') { this.advance(); return { kind: 'lbracket', value: '[', line: startLine, col: startCol }; }
    if (c === ']') { this.advance(); return { kind: 'rbracket', value: ']', line: startLine, col: startCol }; }

    // Hex integer 0x...
    if (c === '0' && (this.text[this.pos + 1] === 'x' || this.text[this.pos + 1] === 'X')) {
      let val = '';
      this.advance(); this.advance(); // consume 0x
      while (/[0-9a-fA-F]/.test(this.ch())) val += this.advance();
      return { kind: 'integer', value: '0x' + val, line: startLine, col: startCol };
    }

    // Negative integer or digit
    if (isDigit(c) || (c === '-' && isDigit(this.text[this.pos + 1] || ''))) {
      let val = '';
      if (c === '-') val += this.advance();
      while (isDigit(this.ch())) val += this.advance();
      return { kind: 'integer', value: val, line: startLine, col: startCol };
    }

    // Identifier or keyword — CON tokens can contain dots (e.g. geta[ri].field is a single token
    // in the generated output). We read the full "word" including embedded dots/brackets so we
    // can match struct accessor patterns like "geta[ri].x" in one shot.
    if (/[A-Za-z_]/.test(c)) {
      let val = '';
      // Read identifier characters; also absorb [.*] and .word suffixes so struct
      // accessor tokens like "geta[ri].x" are read as a single token.
      while (this.pos < this.text.length && isIdentChar(this.ch())) val += this.advance();

      // Absorb optional [<anything>] subscript, tracking nested brackets so that
      // tokens like "gettiledata[sprite[].picnum].ysize" are read as one unit.
      if (this.ch() === '[') {
        val += this.advance(); // opening [
        let depth = 1;
        while (this.pos < this.text.length && depth > 0 && this.ch() !== '\n') {
          const ch = this.advance();
          val += ch;
          if (ch === '[') depth++;
          else if (ch === ']') depth--;
        }
      }

      // Absorb optional .field suffix
      if (this.ch() === '.') {
        val += this.advance(); // .
        while (this.pos < this.text.length && isIdentChar(this.ch())) val += this.advance();
      }

      const lower = val.toLowerCase();
      const kind: TokenKind = KEYWORDS.has(lower) ? 'keyword' : 'identifier';
      return { kind, value: val, line: startLine, col: startCol };
    }

    // Unknown character — skip it and return a synthetic identifier
    const unknown = this.advance();
    return { kind: 'identifier', value: unknown, line: startLine, col: startCol };
  }
}
