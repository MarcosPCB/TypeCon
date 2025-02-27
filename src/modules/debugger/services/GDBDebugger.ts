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

const GV_FLAG_CONSTANT = 2048;

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
  public paused: boolean;

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
    this.paused = true;
  }

  private setupListeners() {
    this.gdb.stdout.on('data', (data) => {
        const output = data.toString();
        if(this.gdbLog)
          console.log(output);

        this.buffer += output;

        if (this.buffer.includes('^done') || this.buffer.includes('*stopped') || this.buffer.includes('^error')) {
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
    this.buffer = this.buffer.replace(/\(gdb\)\s*/g, "");
    let buf = this.buffer.split(splitter + ',', 2)[1].slice(0, this.buffer.length);
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

  public async GetGameVarID(name: string) {
    await this.sendCommand(`-data-evaluate-expression "hash_find(&h_gamevars, \\\"${name}\\\")"`);
    const id = Number(this.getJSONObj('^done').value);

    return id;
  }

  public async GetGameArrayID(name: string) {
    await this.sendCommand(`-data-evaluate-expression "hash_find(&h_arrays, \\\"${name}\\\")"`);
    const id = Number(this.getJSONObj('^done').value);

    return id;
  }

  public async GetCurrentGameVarValue(name: string, type: number) {
    if(type < 0 || type > 2) {
      console.log(`Type must be 0: global, 1: per-player or 2: per-actor`);
      return;
    }

    const varID = await this.GetGameVarID(name);

    if(varID == -1) {
      console.log(`Variable ${name} does not exist`);
      return;
    }

    await this.sendCommand(`-data-evaluate-expression aGameVars[${varID}].flags`);
    const flags = Number(this.getJSONObj('^done').value)
    if((type > 0 && !(flags & type)) || (type == 0 && (flags & type))) {
      console.log(`Variable ${name} is not the requested type. Requested type: ${type}, flags: ${flags}`);
      return;
    }

    switch(type) {
      case 0:
        await this.sendCommand(`-data-evaluate-expression aGameVars[${varID}].global`);
        break;

      case 1:
        await this.sendCommand(`-data-evaluate-expression aGameVars[${varID}].pValues[vm.playerNum]`);
        break;

      case 2:
        await this.sendCommand(`-data-evaluate-expression aGameVars[${varID}].pValues[vm.spriteNum]`);
        break;
    }

    const val = Number(this.getJSONObj('^done').value);
    console.log(`Variable ${name}: ${val}`);
  }

  public async GetCurrentGameArrayValue(name: string, index: number) {
    const varID = await this.GetGameArrayID(name);

    if(varID == -1) {
      console.log(`Array ${name} does not exist`);
      return;
    }

    await this.sendCommand(`-data-evaluate-expression aGameArrays[${varID}].pValues[${index}]`);
    
    const val = Number(this.getJSONObj('^done').value);
    console.log(`Array ${name}[${index}]: ${val}`);
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

  public async pause(force?: boolean) {
    //if(!this.paused || force) {
      this.ready = false;
      suspendProcess(this.pid);
      await this.wait();
      console.log('Stopped');
      //this.paused = true;
    //}
  }

  public async Data(data: string) {
    await this.sendCommand(`-data-evaluate-expression ${data}`);
  }

  //First part must be the instruction and then the arguments
  //If you pass more arguments than the command requires, it might lead to bugs or it will break the VM
  //SO BE CAREFUL
  public async ExecuteCON(instructions: string) {
    const tokens = instructions.trim().split(' ');
    let byteCode: number[] = [];

    for(let i = 0; i < tokens.length; i++) {
      if(tokens[i] == ``)
        continue;

      if(!i) {
        await this.Data(`"hash_find(&h_keywords, \\\"${tokens[i]}\\\")"`);
        const ins = Number(this.getJSONObj('^done').value);
        
        if(ins == -1) {
          console.log(`Instruction in ${instructions} is not valid`);
          return;
        }

        byteCode.push(ins);
        continue;
      }

      if(!isNaN(Number(tokens[i]))) {
        byteCode.push(GV_FLAG_CONSTANT);
        byteCode.push(Number(tokens[i]));
        continue;
      }

      await this.Data(`"hash_find(&h_labels, \\\"${tokens[i]}\\\")"`);
      let ins = Number(this.getJSONObj('^done').value);

      if(ins == -1) {
        await this.Data(`"hash_find(&h_gamevars, \\\"${tokens[i]}\\\")"`);
        ins = Number(this.getJSONObj('^done').value);

        if(ins == -1) {
          console.log(`Argument ${tokens[i]} in ${instructions} is not a valid label nor variable`);
          return;
        }
      } else {
        await this.Data(`"labelcode[${ins}]"`);
        ins = Number(this.getJSONObj('^done').value);
        byteCode.push(GV_FLAG_CONSTANT);
      }

      byteCode.push(ins);
      continue;

    }

    if(byteCode.length < 40)
      for(let i = byteCode.length; i < 50; i++)
        byteCode.push(0);

    await this.sendCommand(`set $inst = (intptr_t[${byteCode.length}]) {${new Int32Array(byteCode).join(', ')}}`)
    this.Data(`"VM_DebugSandBox($inst)"`);
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
    this.paused = false;
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