export interface MemorySnapshot {
  rsp: number;           // current stack pointer at this moment
  flatLen: number;       // current flat[] length at this moment
  phaseRspHWM: number;   // peak rsp during this phase only
  phaseFlatHWM: number;  // peak flat[] index during this phase only
  rds: number;           // stack/heap boundary
}

export interface TestResult {
  stateName: string;
  total: number;
  passed: number;
}

export interface VMState {
  vars: Map<string, number>;
  arrays: Map<string, number[]>;
  quotes: Map<number, string>;
  defines: Map<string, number>;
  stackLimit: number;           // rsp >= this → stack overflow (set from `rds` after init)
  _stackOverflowWarned: boolean;
  _vmLS?: string;               // current defstate name (for debug output)
  // Memory tracking — all-time peaks
  peakFlatIdx: number;
  peakRsp: number;
  // Per-phase peaks (reset by resetPhasePeaks())
  _phaseFlatIdx: number;
  _phaseRsp: number;
  snapAfterInit?: MemorySnapshot;
  snapAfterEvents?: MemorySnapshot;
  // Test results collected when DEBUG-TEST marker is encountered
  testResults: TestResult[];
}

export function createVMState(): VMState {
  return {
    vars: new Map(),
    arrays: new Map([['flat', []]]),
    quotes: new Map(),
    defines: new Map(),
    stackLimit: Infinity,
    _stackOverflowWarned: false,
    peakFlatIdx: 0,
    peakRsp: 0,
    _phaseFlatIdx: 0,
    _phaseRsp: 0,
    testResults: [],
  };
}

export function resetPhasePeaks(state: VMState): void {
  state._phaseFlatIdx = state.peakFlatIdx;
  state._phaseRsp = state.vars.get('rsp') ?? 0;
}

export function takeSnapshot(state: VMState): MemorySnapshot {
  return {
    rsp: state.vars.get('rsp') ?? 0,
    flatLen: state.arrays.get('flat')?.length ?? 0,
    phaseRspHWM: state._phaseRsp,
    phaseFlatHWM: state._phaseFlatIdx,
    rds: state.vars.get('rds') ?? 0,
  };
}
