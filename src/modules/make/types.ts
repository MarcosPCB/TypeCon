export interface MakeModuleEntry {
  path: string;
  enabled: boolean;
  required?: boolean;
}

export interface MakeValidateConfig {
  enabled?: boolean;
  warnNearLimits?: boolean;
  baseDirs?: string[];
}

export interface MakeConfig {
  name?: string;
  stackSize?: number;
  heapPageSize?: number;
  heapPageNumber?: number;
  objDir?: string;
  outputDir?: string;
  output?: string;
  defaultInclusion?: boolean;
  precompiledModules?: boolean;
  sources?: string[];
  modules?: MakeModuleEntry[];
  validate?: MakeValidateConfig;
  /** Keys listed here are displayed but not editable in `tcc make config` */
  locked?: string[];
  /** gameVar initial value overrides — equivalent to CLI --vars NAME=VALUE */
  vars?: Record<string, number>;
  /**
   * Test files to run with `tcc make test`.
   * Each entry is a path (relative to the project root) to either:
   *   - a `.test.json`  script (multi-case, assertions, VM simulation)
   *   - a `.ts`         file   (single-file simulation with @DebugTest markers)
   */
  tests?: string[];
}
