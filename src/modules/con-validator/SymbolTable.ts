import { BUILTIN_GAMEVARS, BUILTIN_GAMEARRAYS, LIMITS } from './data/builtinSymbols';
import { KEYWORDS } from './data/keywords';
import { Diagnostic } from './index';

export interface GamevarEntry { flags: number; line: number; }
export interface ArrayEntry  { size: number; flags: number; line: number; }
export interface StateEntry  { line: number; }

export class SymbolTable {
  readonly gamevars  = new Map<string, GamevarEntry>();
  readonly arrays    = new Map<string, ArrayEntry>();
  readonly defines   = new Map<string, number>();
  readonly states    = new Map<string, StateEntry>();
  readonly actions   = new Set<string>();
  readonly moves     = new Set<string>();
  readonly ais       = new Set<string>();
  readonly actors    = new Map<number, number>();  // tileId → line
  readonly quotes    = new Set<number>();

  private diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    this.diagnostics = diagnostics;
  }

  declareGamevar(name: string, flags: number, line: number): void {
    if (name.length >= LIMITS.MAXVARLABEL) {
      this.diagnostics.push({ severity: 'error', line, col: 0,
        code: 'ERROR_VARLABEL_TOO_LONG',
        message: `Gamevar name '${name}' exceeds ${LIMITS.MAXVARLABEL - 1} characters` });
      return;
    }
    if (KEYWORDS.has(name.toLowerCase())) {
      this.diagnostics.push({ severity: 'error', line, col: 0,
        code: 'ERROR_ISAKEYWORD',
        message: `Gamevar name '${name}' is a CON keyword` });
    }
    if (this.gamevars.has(name) || BUILTIN_GAMEVARS.has(name)) return; // duplicate / builtin — silently ignore
    const count = this.gamevars.size;
    if (count >= LIMITS.MAXGAMEVARS) {
      this.diagnostics.push({ severity: 'error', line, col: 0,
        code: 'ERROR_TOO_MANY_GAMEVARS',
        message: `Gamevar count ${count + 1} exceeds MAXGAMEVARS (${LIMITS.MAXGAMEVARS})` });
      return;
    }
    if (count >= LIMITS.MAXGAMEVARS * 0.9) {
      this.diagnostics.push({ severity: 'warning', line, col: 0,
        code: 'WARNING_NEAR_GAMEVAR_LIMIT',
        message: `Gamevar count ${count + 1}/${LIMITS.MAXGAMEVARS} — approaching limit` });
    }
    this.gamevars.set(name, { flags, line });
  }

  declareArray(name: string, size: number, flags: number, line: number): void {
    if (name.length >= LIMITS.MAXVARLABEL) {
      this.diagnostics.push({ severity: 'error', line, col: 0,
        code: 'ERROR_VARLABEL_TOO_LONG',
        message: `Array name '${name}' exceeds ${LIMITS.MAXVARLABEL - 1} characters` });
      return;
    }
    if (this.arrays.has(name) || BUILTIN_GAMEARRAYS.has(name)) return;
    const count = this.arrays.size;
    if (count >= LIMITS.MAXGAMEARRAYS) {
      this.diagnostics.push({ severity: 'error', line, col: 0,
        code: 'ERROR_TOO_MANY_GAMEARRAYS',
        message: `Array count ${count + 1} exceeds MAXGAMEARRAYS (${LIMITS.MAXGAMEARRAYS})` });
      return;
    }
    this.arrays.set(name, { size, flags, line });
  }

  declareState(name: string, line: number): void {
    if (this.states.has(name)) return; // appendstate/prependstate — first occurrence wins
    const count = this.states.size;
    if (count >= LIMITS.MAXLABELS) {
      this.diagnostics.push({ severity: 'error', line, col: 0,
        code: 'ERROR_TOO_MANY_LABELS',
        message: `Label count ${count + 1} exceeds MAXLABELS (${LIMITS.MAXLABELS})` });
      return;
    }
    this.states.set(name, { line });
  }

  defineQuote(index: number, line: number): void {
    if (index < 0 || index >= LIMITS.MAXQUOTES) {
      this.diagnostics.push({ severity: 'error', line, col: 0,
        code: 'ERROR_QUOTE_INDEX_OUT_OF_RANGE',
        message: `Quote index ${index} out of range [0, ${LIMITS.MAXQUOTES - 1}]` });
      return;
    }
    this.quotes.add(index);
  }

  isKnownVar(name: string): boolean {
    return this.gamevars.has(name) || BUILTIN_GAMEVARS.has(name)
        || this.defines.has(name);
  }

  isKnownArray(name: string): boolean {
    return this.arrays.has(name) || BUILTIN_GAMEARRAYS.has(name);
  }

  isKnownState(name: string): boolean {
    return this.states.has(name);
  }

  usageSummary(): string {
    const parts: string[] = [];
    parts.push(`gamevars:  ${this.gamevars.size}/${LIMITS.MAXGAMEVARS}`);
    parts.push(`arrays:    ${this.arrays.size}/${LIMITS.MAXGAMEARRAYS}`);
    parts.push(`states:    ${this.states.size}/${LIMITS.MAXLABELS}`);
    if (this.defines.size  > 0) parts.push(`defines:   ${this.defines.size}`);
    if (this.actions.size  > 0) parts.push(`actions:   ${this.actions.size}`);
    if (this.moves.size    > 0) parts.push(`moves:     ${this.moves.size}`);
    if (this.ais.size      > 0) parts.push(`ais:       ${this.ais.size}`);
    if (this.quotes.size   > 0) parts.push(`quotes:    ${this.quotes.size}/${LIMITS.MAXQUOTES}`);
    return parts.join('  ');
  }
}
