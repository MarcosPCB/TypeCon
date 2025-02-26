import { rejects } from "assert";
import { spawn, ChildProcessWithoutNullStreams, execSync } from "child_process";
import ffi from 'ffi-napi';
import path from "path";
import fs from 'fs';

/// Load kernel32.dll
const kernel32 = ffi.Library("kernel32.dll", {
  OpenProcess: ["int", ["int", "bool", "int"]],
  DebugBreakProcess: ["bool", ["int"]],
  CloseHandle: ["bool", ["int"]]
});

// Windows constants
const PROCESS_ALL_ACCESS = 0x1F0FFF;

function suspendProcess(pid: number) {
  console.log(`Pausing process with PID ${pid}...`);

  // Open the target process
  const processHandle = kernel32.OpenProcess(PROCESS_ALL_ACCESS, false, pid);
  if (processHandle === 0) {
      console.error("Failed to open process!");
      return;
  }

  // Send a break signal
  const success = kernel32.DebugBreakProcess(processHandle);
  if (!success) {
      console.error("Failed to break process!");
  } else {
      console.log("Process paused!");
  }

  // Close the handle
  kernel32.CloseHandle(processHandle);
}
export default class GDBDebugger {
  private gdb: ChildProcessWithoutNullStreams;
  private buffer: string = "";
  private resolveOutput?: (output: string) => void;
  public ready: boolean;
  public bps: number[];
  public cleared: boolean;
  public bps_line: { file: string, line: number }[];
  public pid: number;
  public stepBP: number;
  public scriptFilenames: string[];
  public scriptOffsets: number[];
  private gdbLog: boolean;

  constructor(targetBin?: string, targetPID?: number, gdbLog = false) {
    if(!targetBin && !targetPID)
      throw 'You must specify a binary path OR a PID to be debugger';

    this.gdb = spawn("gdb", ["--interpreter=mi2", targetBin ? `${targetBin}` : `--pid=${targetPID}`], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.setupListeners();

    this.sendCommand('break G_LoadLookups');

    this.bps = [];
    this.cleared = false;
    this.ready = true;
    this.bps_line = [];
    this.pid = 0;
    this.stepBP = 0;
    this.scriptFilenames = [];
    this.scriptOffsets = [];
    this.gdbLog = gdbLog;
  }

  private setupListeners() {
    this.gdb.stdout.on('data', (data) => {
        const output = data.toString();
        if(this.gdbLog)
          console.log(output);

        this.buffer += output;

        if (this.buffer.includes('^done') || this.buffer.includes('*stopped')) {
            if (this.resolveOutput) {
                this.resolveOutput(this.buffer);
                this.resolveOutput = undefined;
            }
            //this.buffer = "";

            this.ready = true;
        }
    });

    this.gdb.stderr.on('data', (data) => {
        console.error('GDB Error:', data.toString());
    });

    this.gdb.on('close', (code) => {
        console.log(`GDB process exited with code ${code}`);
    });
  }

  public getJSONObj(splitter: string, frame_stack?: boolean) {
    const g = this.buffer.indexOf('(gdb)');
    let buf = this.buffer.split(splitter + ',', 2)[1].slice(0, g != -1 ? (g - String('(gdb)').length - 1)  : this.buffer.length);
    if(frame_stack)
      buf = buf.replace(/frame=/g, '');
    if(buf.length > 0) {
      let jsonStr = '';
      //if(buf.startsWith('[') || buf.startsWith('{'))
        //jsonStr = buf.replace(/\b(\w+)\b(?=\s*=)/g, '"$1"').replace(/=/g, ':');
      jsonStr = String('{' + buf + '}').replace(/\b(\w+)\b(?=\s*=)/g, '"$1"').replace(/=/g, ':');
      try {
        const obj = JSON.parse(jsonStr);
        return obj;
      } catch(err) {
        console.log(err);
        console.log(jsonStr);
      }
    }

    return null;
  }

  public async getInferiorPIDAsJson(): Promise<string> {
    console.log('Fetching inferiors in JSON format...');
    await this.sendCommand(`-list-thread-groups`);
    
    const obj = this.getJSONObj('^done').groups;
    if(!obj)
      return JSON.stringify({ error: "No PID found" });

    // Parse output as JSON format
    if (obj[0].pid) {
        console.log('Inferior PID JSON:', obj[0].pid);
        this.pid = obj[0].pid;
        return obj[0].pid;
    } else {
        console.log("No PID found.");
        return JSON.stringify({ error: "No PID found" });
    }
  }

  public async wait() {
    const sleep = (ms: any) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    while(!this.ready)
      await sleep(10);

    console.log('ready');
  }
  
  public async SetBreakpointAtLine(file: string, line: number) {
    if(path.isAbsolute(file) || file.includes('\\') || file.includes('/')) {
      const baseFile = path.basename(file);
      file = file.slice(0, file.length - baseFile.length) + baseFile.toUpperCase();
    } else file = file.toUpperCase();

    await this.sendCommand('-data-evaluate-expression ' + `"VM_CONSetDebugLine(${line}, \\\"${file}\\\")"`);

    this.bps_line.push({
      file,
      line
    });

    console.log(`Added breakpoint in line: ${line} at file: ${file}`);
  }

  public async UnsetBreakpointAtLine(file: string, line: number) {
    if(path.isAbsolute(file) || file.includes(path.sep)) {
      const baseFile = path.basename(file);
      file = file.slice(0, file.length - baseFile.length) + baseFile.toUpperCase();
    } else file = file.toUpperCase();

    const index = this.bps_line.findIndex(e => e.file == file && e.line == line);

    if(!index) {
      console.log('No break point was found for line: ' + line + ' at file: ' + file);
      return;
    }

    await this.sendCommand('-data-evaluate-expression ' + `"VM_CONUnsetDebugLine(${line}, \\\"${file}\\\")"`);

    this.bps_line.splice(index, 1);
    console.log(`Removed breakpoint in line: ${line} at file: ${file}`);
  }

  public async RemoveAllLineBreapoints() {
    this.bps_line.forEach(async e => {
      await this.sendCommand('-data-evaluate-expression ' + `"VM_CONUnsetDebugLine(${e.line}, \\\"${e.file}\\\")"`);
      console.log(`Removed breakpoint in line: ${e.line} at file: ${e.file}`);
    });

    this.bps_line.length = 0;
  }

  // Run the program inside GDB
  public run() {
    this.sendCommand("run");
  }

  public GetScriptContent(index) {
    try {
      return fs.readFileSync(this.scriptFilenames[index]).toString();
    } catch(err) {
      console.log(err);
      return null;
    }
  }

  public async PrintWhereItStopped(num_lines = 6) {
    await this.sendCommand(`-data-evaluate-expression g_tw`);
    const line = this.getJSONObj('^done').value >> 12;

    await this.sendCommand(`-data-evaluate-expression "(insptr - apScript)"`);
    const offset = Number(this.getJSONObj('^done').value);

    const index = this.scriptOffsets.findIndex(e => offset >= e);
    const file = this.GetScriptContent(index);

    if(!file) {
      console.log('Unable to open script: ' + this.scriptFilenames[index]);
      return;
    }

    const script = file.split('\n');

    for (let i = line - Math.ceil(num_lines / 2); i < Math.min((line - Math.ceil(num_lines / 2)) + num_lines, script.length); i++) {
      const lineNumber = (i + 1).toString().padStart(4, " ");
      const separator = " | ";
      
      if (i + 1 == line) {
          // Highlight current line in yellow
          console.log(`\x1b[33m${lineNumber}${separator}${script[i]}\x1b[0m`);
      } else {
          console.log(`${lineNumber}${separator}${script[i]}`);
      }
    }
  }

  public async pause() {
    this.ready = false;
    suspendProcess(this.pid);
    await this.wait();
    console.log('Stopped');
  }

  public sendCommand(command: string): Promise<boolean> {
    this.ready = false;
    this.buffer = "";
    return new Promise(async (resolve) => {
        const sleep = (ms: any) =>
          new Promise((resolve) => setTimeout(resolve, ms));

        //this.resolveOutput = resolve;
        this.gdb.stdin.write(`${command}\n`);

        while(!this.ready)
          await sleep(10);

        console.log('ready');

        resolve(true);
    });
  }

  public async continueExecution() {
    await this.sendCommand(`-break-delete ${this.stepBP}`);
    this.cleared = false;
    //this.bps_line.forEach((e) => this.SetBreakpointAtLine(e.file, e.line, true));
    this.sendCommand("-exec-continue");
  }

  public async stepInto() {
    if(!this.cleared) {
      await this.wait();
      await this.sendCommand(`-break-watch g_tw`);
      const obj = this.getJSONObj('^done').wpt;

      this.stepBP = obj.number;
        
      this.cleared = true;
    }

    this.sendCommand("-exec-continue");
  }

  public async stepOver() {
    await this.sendCommand("next");
  }

  public close() {
    this.gdb.stdin.end();
  }

  public async firstStart() {
    await this.sendCommand('-exec-run --start');
    await this.getInferiorPIDAsJson();
    await this.sendCommand(`-exec-continue`);
    await this.sendCommand(`set $ptr = vmoffset`)

    await this.sendCommand('-data-evaluate-expression vmoffset->fn');

    let r = this.getJSONObj('^done').value.match(/"([^"]+)"/)[1];
    this.scriptFilenames.push(r);

    await this.sendCommand('-data-evaluate-expression vmoffset->offset');
    this.scriptOffsets.push(this.getJSONObj('^done').value);

    while(true) {
      await this.sendCommand('-data-evaluate-expression $ptr->next');
      r = Number(this.getJSONObj('^done').value);
      if(r != 0) {
        await this.sendCommand(`set $ptr = $ptr->next`);
        await this.sendCommand('-data-evaluate-expression $ptr->fn');
        r = this.getJSONObj('^done').value.match(/"([^"]+)"/)[1];
        if(!this.scriptFilenames.includes(r)) {
          this.scriptFilenames.push(r);
          await this.sendCommand('-data-evaluate-expression $ptr->offset');
          this.scriptOffsets.push(this.getJSONObj('^done').value);
        }
      } else break;
    }

    console.log(`Script files are: ${this.scriptFilenames.join(', ')}`);
  }
}

/*
// Example usage:
const debuggerInstance = new GDBDebugger(12345); // Replace with the target PID

setTimeout(() => {
  debuggerInstance.stepInto(); // Step into the next instruction
}, 2000);

setTimeout(() => {
  debuggerInstance.close(); // Close the debugger
}, 10000);
*/