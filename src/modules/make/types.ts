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
}
