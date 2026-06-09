export type ImmediateOperand = { kind: 'immediate'; value: number };
export type VarOperand       = { kind: 'var';       name: string };
export type ArrayOperand     = { kind: 'array';     name: string; index: Operand };
export type Operand = ImmediateOperand | VarOperand | ArrayOperand;

export type ConditionalOp =
  | 'ifvarl' | 'ifvarle' | 'ifvare' | 'ifvarn' | 'ifvarg' | 'ifvarge'
  | 'ifvarand' | 'ifvaror'
  | 'ifl' | 'ifle' | 'ife' | 'ifn' | 'ifg' | 'ifge'
  | 'ifand' | 'ifor' | 'ifeither';

export type Statement =
  | { op: 'set' | 'add' | 'sub' | 'mul' | 'div' | 'mod' | 'and' | 'or' | 'xor' | 'shiftl' | 'shiftr' | 'divr'; dst: Operand; src: Operand }
  | { op: 'abs' | 'inv'; dst: Operand }
  | { op: 'clamp'; dst: Operand; min: Operand; max: Operand }
  | { op: 'sin' | 'cos'; dst: Operand; src: Operand }
  | { op: 'sqrt'; dst: Operand; src: Operand }
  | { op: 'getangle'; dst: Operand; dx: Operand; dy: Operand }
  | { op: 'mulscale'; dst: Operand; a: Operand; b: Operand; scale: Operand }
  | { op: 'divscale'; dst: Operand; a: Operand; b: Operand; scale: Operand }
  | { op: 'setarray'; arr: Operand; val: Operand }
  | { op: 'getarraysize'; dst: Operand; arr: string }
  | { op: 'resizearray'; arr: string; size: Operand }
  | { op: 'copy'; dst: string; dstIdx: Operand; src: string; srcIdx: Operand; count: Operand }
  | { op: 'setarrayseq'; arr: string; vars: string[] }
  | { op: 'getarrayseq'; arr: string; vars: string[] }
  | { op: 'state'; name: string }
  | { op: ConditionalOp; a: Operand; b: Operand; body: Statement[]; elseBody?: Statement[] }
  | { op: 'whilevarn' | 'whilevarl' | 'whilel' | 'whilen'; a: Operand; b: Operand; body: Statement[] }
  | { op: 'switch'; val: Operand; cases: { value: number; body: Statement[] }[]; default?: Statement[] }
  | { op: 'break' | 'continue' | 'terminate' | 'exit' }
  | { op: 'qputs'; quote: Operand; text: string }
  | { op: 'qstrcpy' | 'qstrcat'; dst: Operand; src: Operand }
  | { op: 'qstrncat'; dst: Operand; src: Operand; len: Operand }
  | { op: 'qsprintf' | 'sqprintf'; dst: Operand; fmt: Operand; args: Operand[] }
  | { op: 'qsubstr'; dst: Operand; src: Operand; start: Operand; len: Operand }
  | { op: 'qgetsysstr'; dst: Operand; src: Operand }
  | { op: 'quote' | 'userquote'; quote: Operand }
  | { op: 'echo'; val: Operand }
  | { op: 'addlogvar'; val: Operand }
  | { op: 'getstruct'; struct: 'actor' | 'player' | 'sector' | 'wall'; index: Operand; field: string; dst: Operand }
  | { op: 'setstruct'; struct: 'actor' | 'player' | 'sector' | 'wall'; index: Operand; field: string; src: Operand }
  | { op: 'ifhitweapon'; body: Statement[]; elseBody?: Statement[] }
  | { op: 'readarrayfromfile' | 'writearraytofile'; arr: string; quote: Operand }
  | { op: 'defstate'; name: string; body: Statement[] }
  | { op: 'marker'; name: string }
  | { op: 'nullop' | 'noop' };
