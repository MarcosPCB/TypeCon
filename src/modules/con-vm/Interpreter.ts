import { Operand, Statement, ConditionalOp } from './Types';
import { VMState, getStructField, setStructField } from './Memory';
import * as fs from 'fs';
import { sintable, mulscale, divscale, buildSqrt } from './Tables';

// Control-flow exception signals
// CON semantics: exit=loop-break, terminate=return-from-defstate, break=exit-actor
export class BreakSignal { }    // thrown by CON `exit` (exits current loop)
export class ContinueSignal { } // thrown by CON `continue`
export class ExitStateSignal { }// thrown by CON `terminate` (exits current defstate)
export class TerminateSignal { }// thrown by CON `break` (exits actor/event entirely)

function readOperand(op: Operand, state: VMState): number {
  switch (op.kind) {
    case 'immediate':
      return op.value;
    case 'var': {
      const v = state.vars.get(op.name);
      if (v !== undefined) return v;
      const d = state.defines.get(op.name);
      if (d !== undefined) return d;
      return 0;
    }
    case 'array': {
      const arr = state.arrays.get(op.name);
      if (!arr) return 0;
      const idx = readOperand(op.index, state);
      if (idx < 0 || idx >= arr.length) {
        console.error(`[CONVM] BOUNDS ERROR read ${op.name}[${idx}] (size=${arr.length}) — rsp=${state.vars.get('rsp')} rbp=${state.vars.get('rbp')} ri=${state.vars.get('ri')} ra=${state.vars.get('ra')} rb=${state.vars.get('rb')} in:${_vmLS}`);
        return 0;
      }
      return arr[idx] ?? 0;
    }
  }
}

function writeOperand(op: Operand, value: number, state: VMState): void {
  const v = value | 0;
  switch (op.kind) {
    case 'immediate': return;
    case 'var':
      state.vars.set(op.name, v);
      if (op.name === 'rsp') {
        if (v > state.peakRsp) state.peakRsp = v;
        if (v > state._phaseRsp) state._phaseRsp = v;
        if (v >= state.stackLimit && !state._stackOverflowWarned) {
          state._stackOverflowWarned = true;
          console.warn(`[CONVM] WARNING: Stack overflow — rsp=${v} has exceeded the stack limit (rds=${state.stackLimit}). Stack is corrupting global/heap memory.`);
        }
      }
      break;
    case 'array': {
      let arr = state.arrays.get(op.name);
      if (!arr) { arr = []; state.arrays.set(op.name, arr); }
      const idx = readOperand(op.index, state);
      if (idx < 0 || idx > 20_000_000) {
        console.error(`[CONVM] BOUNDS ERROR write ${op.name}[${idx}] = ${v} — rsp=${state.vars.get('rsp')} rbp=${state.vars.get('rbp')} ri=${state.vars.get('ri')} ra=${state.vars.get('ra')} rb=${state.vars.get('rb')} in:${_vmLS}`);
        return;
      }
      // Grow array on demand — but warn when growing beyond the declared initial
      // size (resizearray should have been called first; if not it means the CON
      // program is relying on auto-grow which EDuke32 does not support)
      if (idx >= arr.length && op.name === 'flat') {
        console.warn(`[CONVM] WARNING: write flat[${idx}] exceeds current flat size (${arr.length}) without a prior resizearray — this will fail in EDuke32`);
      }
      while (arr.length <= idx) arr.push(0);
      arr[idx] = v;
      if (op.name === 'flat') {
        if (idx > state.peakFlatIdx) state.peakFlatIdx = idx;
        if (idx > state._phaseFlatIdx) state._phaseFlatIdx = idx;
      }
      break;
    }
  }
}

function evalCondition(op: ConditionalOp, a: number, b: number): boolean {
  switch (op) {
    case 'ifvarl': case 'ifl': return a < b;
    case 'ifvarle': case 'ifle': return a <= b;
    case 'ifvare': case 'ife': return a === b;
    case 'ifvarn': case 'ifn': return a !== b;
    case 'ifvarg': case 'ifg': return a > b;
    case 'ifvarge': case 'ifge': return a >= b;
    case 'ifvarand': case 'ifand': return (a & b) !== 0;
    case 'ifvaror': case 'ifor': return (a | b) !== 0;
    case 'ifeither': return a !== 0 || b !== 0;
    default: return false;
  }
}

// Format a qsprintf/sqprintf pattern: %d → number, %s → quote string
function formatSprintf(fmt: string, args: Operand[], state: VMState): string {
  let argIdx = 0;
  return fmt.replace(/%[ds%]/g, match => {
    if (match === '%%') return '%';
    const arg = args[argIdx++];
    if (!arg) return match;
    const val = readOperand(arg, state);
    if (match === '%d') return String(val);
    if (match === '%s') return state.quotes.get(val) ?? '';
    return match;
  });
}



function structMapFor(struct: string, state: VMState): Map<number, Map<string, number>> {
  if (struct === 'actor')  return state.actorFields;
  if (struct === 'player') return state.playerFields;
  if (struct === 'sector') return state.sectorFields;
  return state.wallFields;
}

let _vmSteps = 0; let _vmLS = '?';
export function executeStatements(
  stmts: Statement[],
  state: VMState,
  stateMap: Map<string, Statement[]>,
  depth = 0,
): void {
  if (depth > 500) {
    console.error('[CONVM] Maximum call depth exceeded — possible infinite recursion');
    throw new TerminateSignal();
  }

  for (const s of stmts) {
    if (++_vmSteps > 10_000_000) {
      const v = (n: string) => state.vars.get(n) ?? 0;
      console.error(`[CONVM] LIMIT in: ${_vmLS} op:${s.op}`);
      console.error(`r4=${v('r4')} r5=${v('r5')} r8=${v('r8')} r9=${v('r9')} r10=${v('r10')} rc=${v('rc')} ri=${v('ri')} rbp=${v('rbp')} rsp=${v('rsp')}`);
      console.error(`flat[r8]=${(state.arrays.get('flat') ?? [])[v('r8')] ?? 'OOB'}`);
      throw new TerminateSignal();
    }
    switch (s.op) {
      // ── Arithmetic ────────────────────────────────────────────────────────
      case 'set': writeOperand(s.dst, readOperand(s.src, state), state); break;
      case 'add': writeOperand(s.dst, (readOperand(s.dst, state) + readOperand(s.src, state)) | 0, state); break;
      case 'sub': writeOperand(s.dst, (readOperand(s.dst, state) - readOperand(s.src, state)) | 0, state); break;
      case 'mul': writeOperand(s.dst, Math.imul(readOperand(s.dst, state), readOperand(s.src, state)), state); break;
      case 'div': {
        const divisor = readOperand(s.src, state);
        writeOperand(s.dst, divisor === 0 ? 0 : ((readOperand(s.dst, state) / divisor) | 0), state);
        break;
      }
      case 'mod': {
        const m = readOperand(s.src, state);
        writeOperand(s.dst, m === 0 ? 0 : (readOperand(s.dst, state) % m) | 0, state);
        break;
      }
      case 'and': writeOperand(s.dst, (readOperand(s.dst, state) & readOperand(s.src, state)) | 0, state); break;
      case 'or': writeOperand(s.dst, (readOperand(s.dst, state) | readOperand(s.src, state)) | 0, state); break;
      case 'divr': {
        const dv = readOperand(s.src, state);
        const dividend = readOperand(s.dst, state);
        writeOperand(s.dst, dv === 0 ? 0 : Math.round(dividend / dv) | 0, state);
        break;
      }
      case 'xor': writeOperand(s.dst, (readOperand(s.dst, state) ^ readOperand(s.src, state)) | 0, state); break;
      case 'shiftl': writeOperand(s.dst, (readOperand(s.dst, state) << readOperand(s.src, state)) | 0, state); break;
      case 'shiftr': writeOperand(s.dst, (readOperand(s.dst, state) >>> readOperand(s.src, state)) | 0, state); break;
      case 'abs': writeOperand(s.dst, Math.abs(readOperand(s.dst, state)) | 0, state); break;
      case 'inv': writeOperand(s.dst, (-readOperand(s.dst, state)) | 0, state); break;
      case 'clamp': {
        const v = readOperand(s.dst, state);
        const lo = readOperand(s.min, state);
        const hi = readOperand(s.max, state);
        writeOperand(s.dst, Math.min(Math.max(v, lo), hi) | 0, state);
        break;
      }

      // ── Math ──────────────────────────────────────────────────────────────
      case 'sin': {
        const angle = readOperand(s.src, state) & 2047;
        writeOperand(s.dst, sintable[angle], state);
        break;
      }
      case 'cos': {
        const angle = (readOperand(s.src, state) + 512) & 2047;
        writeOperand(s.dst, sintable[angle], state);
        break;
      }
      case 'getangle': {
        const dx = readOperand(s.dx, state);
        const dy = readOperand(s.dy, state);
        const ang = (dx | dy) === 0 ? 0
          : Math.round(Math.atan2(dy, dx) * (1024 / Math.PI)) & 2047;
        writeOperand(s.dst, ang, state);
        break;
      }
      case 'sqrt':
        writeOperand(s.dst, buildSqrt(readOperand(s.src, state)), state);
        break;
      case 'mulscale':
        writeOperand(s.dst, mulscale(readOperand(s.a, state), readOperand(s.b, state), readOperand(s.scale, state)), state);
        break;
      case 'divscale':
        writeOperand(s.dst, divscale(readOperand(s.a, state), readOperand(s.b, state), readOperand(s.scale, state)), state);
        break;

      // ── Array ops ─────────────────────────────────────────────────────────
      case 'setarray':
        writeOperand(s.arr, readOperand(s.val, state), state);
        break;
      case 'getarraysize': {
        const arr = state.arrays.get(s.arr);
        writeOperand(s.dst, arr ? arr.length : 0, state);
        break;
      }
      case 'resizearray': {
        const newSize = readOperand(s.size, state);
        let arr = state.arrays.get(s.arr) ?? [];
        while (arr.length < newSize) arr.push(0);
        arr.length = Math.max(arr.length, newSize);
        state.arrays.set(s.arr, arr);
        if (s.arr === 'flat' && newSize > 0) {
          if (newSize - 1 > state.peakFlatIdx) state.peakFlatIdx = newSize - 1;
          if (newSize - 1 > state._phaseFlatIdx) state._phaseFlatIdx = newSize - 1;
        }
        break;
      }
      case 'copy': {
        const srcArr = state.arrays.get(s.src) ?? [];
        let dstArr = state.arrays.get(s.dst) ?? [];
        const si = readOperand(s.srcIdx, state);
        const di = readOperand(s.dstIdx, state);
        const cnt = readOperand(s.count, state);
        for (let i = 0; i < cnt; i++) {
          while (dstArr.length <= di + i) dstArr.push(0);
          dstArr[di + i] = srcArr[si + i] ?? 0;
        }
        state.arrays.set(s.dst, dstArr);
        break;
      }
      case 'setarrayseq': {
        let arr = state.arrays.get(s.arr) ?? [];
        for (let i = 0; i < s.vars.length; i++) {
          while (arr.length <= i) arr.push(0);
          arr[i] = state.vars.get(s.vars[i]) ?? 0;
        }
        state.arrays.set(s.arr, arr);
        break;
      }
      case 'getarrayseq': {
        const arr = state.arrays.get(s.arr) ?? [];
        for (let i = 0; i < s.vars.length; i++) {
          state.vars.set(s.vars[i], (arr[i] ?? 0) | 0);
        }
        break;
      }

      // ── File I/O ──────────────────────────────────────────────────────────
      case 'readarrayfromfile': {
        const quoteIdx = readOperand(s.quote, state);
        const filepath = state.quotes.get(quoteIdx) ?? '';
        const packed: number[] = [];
        if (filepath) {
          try {
            const buf = fs.readFileSync(filepath);
            // Pack 4 bytes per int32, little-endian (LSB = byte 0)
            for (let i = 0; i < buf.length; i += 4) {
              const b0 = buf[i]   ?? 0;
              const b1 = buf[i+1] ?? 0;
              const b2 = buf[i+2] ?? 0;
              const b3 = buf[i+3] ?? 0;
              packed.push(((b0) | (b1 << 8) | (b2 << 16) | (b3 << 24)) | 0);
            }
          } catch {
            console.warn(`[CONVM] WARNING: readarrayfromfile: could not read '${filepath}'`);
          }
        } else {
          console.warn(`[CONVM] WARNING: readarrayfromfile: empty path in quote ${quoteIdx}`);
        }
        state.arrays.set(s.arr, packed);
        break;
      }
      case 'writearraytofile': {
        const quoteIdx = readOperand(s.quote, state);
        const filepath = state.quotes.get(quoteIdx) ?? '';
        if (filepath) {
          const arr = state.arrays.get(s.arr) ?? [];
          const bytes: number[] = [];
          for (const word of arr) {
            bytes.push(word & 0xFF);
            bytes.push((word >> 8) & 0xFF);
            bytes.push((word >> 16) & 0xFF);
            bytes.push((word >> 24) & 0xFF);
          }
          try {
            fs.writeFileSync(filepath, Buffer.from(bytes));
          } catch {
            console.warn(`[CONVM] WARNING: writearraytofile: could not write '${filepath}'`);
          }
        }
        break;
      }

      // ── ifhitweapon ───────────────────────────────────────────────────────
      case 'ifhitweapon': {
        const htextra = getStructField(state.actorFields, state.thisactor, 'htextra');
        if (htextra > 0) {
          const extra    = getStructField(state.actorFields, state.thisactor, 'extra');
          setStructField(state.actorFields, state.thisactor, 'extra',   Math.max(0, extra - htextra));
          setStructField(state.actorFields, state.thisactor, 'htextra', 0);
          if (s.body.length > 0) executeStatements(s.body, state, stateMap, depth + 1);
        } else if (s.elseBody) {
          executeStatements(s.elseBody, state, stateMap, depth + 1);
        }
        break;
      }

      // ── Game structure access ─────────────────────────────────────────────
      case 'getstruct': {
        const idx = readOperand(s.index, state) | 0;
        writeOperand(s.dst, getStructField(structMapFor(s.struct, state), idx, s.field), state);
        break;
      }
      case 'setstruct': {
        const idx = readOperand(s.index, state) | 0;
        setStructField(structMapFor(s.struct, state), idx, s.field, readOperand(s.src, state));
        break;
      }

      // ── State call ────────────────────────────────────────────────────────
      case 'state': {
        // Native override: CFile_GetBuffer — compiled code has a +1 off-by-one
        // bug from BufferToSourceIndex(true). Return flat[this+2] directly.
        // r0 holds the CFile 'this' pointer at the point of the state call.
        if (s.name === 'CFile_GetBuffer') {
          const flat    = state.arrays.get('flat') ?? [];
          const thisPtr = state.vars.get('r0') ?? 0; // r0 = CFile ptr (the 'this' arg)
          const bufPtr  = flat[thisPtr + 2] ?? 0;    // flat[this+2] = this.buffer
          state.vars.set('rb', bufPtr);
          break;
        }

        const body = stateMap.get(s.name);
        if (body) {
          const _p = _vmLS; _vmLS = s.name;
          const isTestState = body.length > 0 && body[0].op === 'marker' && (body[0] as any).name === 'DEBUG-TEST';
          try {
            executeStatements(body, state, stateMap, depth + 1);
          } catch (e) {
            _vmLS = _p;
            // terminate exits the defstate; exit (BreakSignal) outside any loop also exits
            if (e instanceof ExitStateSignal || e instanceof BreakSignal) break;
            // TerminateSignal (break = actor exit) and ContinueSignal propagate to caller
            throw e;
          }
          _vmLS = _p;
          if (isTestState) {
            const rb = state.vars.get('rb') ?? 0;
            const total = rb >>> 12;
            const passed = rb & 0xFFF;
            state.testResults.push({ stateName: s.name, total, passed });
          }
        }
        // Unknown state: warn so the user can spot undefined state calls
        else {
          console.warn(`[CONVM] WARNING: state '${s.name}' not found — not defined in this CON (called from: ${_vmLS})`);
        }
        break;
      }

      // ── Conditionals ──────────────────────────────────────────────────────
      case 'ifvarl': case 'ifvarle': case 'ifvare': case 'ifvarn':
      case 'ifvarg': case 'ifvarge': case 'ifvarand': case 'ifvaror':
      case 'ifl': case 'ifle': case 'ife': case 'ifn': case 'ifg': case 'ifge':
      case 'ifand': case 'ifor': case 'ifeither': {
        const a = readOperand(s.a, state);
        const b = readOperand(s.b, state);
        const taken = evalCondition(s.op as ConditionalOp, a, b);
        const branchBody = taken ? s.body : (s.elseBody ?? []);
        if (branchBody.length > 0) {
          executeStatements(branchBody, state, stateMap, depth + 1);
        }
        break;
      }

      // ── While loops ───────────────────────────────────────────────────────
      case 'whilevarn': {
        while (readOperand(s.a, state) !== readOperand(s.b, state)) {
          try {
            executeStatements(s.body, state, stateMap, depth + 1);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        break;
      }
      case 'whilevarl':
      case 'whilel': {
        while (readOperand(s.a, state) < readOperand(s.b, state)) {
          try {
            executeStatements(s.body, state, stateMap, depth + 1);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        break;
      }

      // ── Switch ────────────────────────────────────────────────────────────
      case 'switch': {
        const val = readOperand(s.val, state);
        const matched = s.cases.find(c => c.value === val);
        const body = matched?.body ?? s.default ?? [];
        try {
          executeStatements(body, state, stateMap, depth + 1);
        } catch (e) {
          // In CON, both `exit` (BreakSignal) and `break` (TerminateSignal) exit
          // the current switch case — `break` is used for case exit in old-style
          // CON switches (e.g. CONUnsafe blocks from CFile.ts).
          if (e instanceof BreakSignal || e instanceof TerminateSignal) break;
          throw e;
        }
        break;
      }

      // ── Signals ───────────────────────────────────────────────────────────
      case 'exit': throw new BreakSignal();     // exits current loop
      case 'continue': throw new ContinueSignal();  // next loop iteration
      case 'terminate': throw new ExitStateSignal(); // exits current defstate
      case 'break': throw new TerminateSignal(); // exits actor/event entirely

      // ── Quote operations ──────────────────────────────────────────────────
      case 'qputs': {
        const idx = readOperand(s.quote, state);
        state.quotes.set(idx, s.text);
        break;
      }
      case 'qstrcpy': {
        const dst = readOperand(s.dst, state);
        const src = readOperand(s.src, state);
        state.quotes.set(dst, state.quotes.get(src) ?? '');
        break;
      }
      case 'qstrcat': {
        const dst = readOperand(s.dst, state);
        const src = readOperand(s.src, state);
        state.quotes.set(dst, (state.quotes.get(dst) ?? '') + (state.quotes.get(src) ?? ''));
        break;
      }
      case 'qstrncat': {
        const dst = readOperand(s.dst, state);
        const src = readOperand(s.src, state);
        const len = readOperand(s.len, state);
        const append = (state.quotes.get(src) ?? '').substring(0, len);
        state.quotes.set(dst, (state.quotes.get(dst) ?? '') + append);
        break;
      }
      case 'qsprintf':
      case 'sqprintf': {
        const dst = readOperand(s.dst, state);
        const fmtIdx = readOperand(s.fmt, state);
        const fmt = state.quotes.get(fmtIdx) ?? '';
        state.quotes.set(dst, formatSprintf(fmt, s.args, state));
        break;
      }
      case 'qsubstr': {
        const dst = readOperand(s.dst, state);
        const src = readOperand(s.src, state);
        const start = readOperand(s.start, state);
        const len = readOperand(s.len, state);
        const text = state.quotes.get(src) ?? '';
        state.quotes.set(dst, text.substring(start, start + len));
        break;
      }
      case 'qgetsysstr': {
        const dst = readOperand(s.dst, state);
        const src = readOperand(s.src, state);
        state.quotes.set(dst, state.quotes.get(src) ?? '');
        break;
      }

      // ── Output ────────────────────────────────────────────────────────────
      case 'echo': {
        // echo N — prints the string stored in quote slot N
        const idx = readOperand(s.val, state);
        console.log(state.quotes.get(idx) ?? '');
        break;
      }
      case 'addlogvar': {
        const v = readOperand(s.val, state);
        if (s.val.kind === 'var') console.log(`${s.val.name}: ${v}`);
        else if (s.val.kind === 'array') console.log(`${s.val.name}[...]: ${v}`);
        else console.log(v);
        break;
      }
      case 'quote':
      case 'userquote': {
        const idx = readOperand(s.quote, state);
        console.log(state.quotes.get(idx) ?? '');
        break;
      }

      // ── Defstate (stored, not executed inline) ────────────────────────────
      case 'defstate':
        stateMap.set(s.name, s.body);
        break;

      // ── Debug marker ──────────────────────────────────────────────────────
      case 'marker':
        // Handled by the parent `state` call handler; no runtime action needed
        break;

      case 'nullop':
      case 'noop':
        break;
    }
  }
}
