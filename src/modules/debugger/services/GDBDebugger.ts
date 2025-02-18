import { rejects } from "assert";
import { spawn, ChildProcessWithoutNullStreams, execSync } from "child_process";
import ffi from 'ffi-napi';
import ref from 'ref-napi';

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

  constructor(targetBin?: string, targetPID?: number) {
    if(!targetBin && !targetPID)
      throw 'You must specify a binary path OR a PID to be debugger';

    this.gdb = spawn("gdb", ["--interpreter=mi2", targetBin ? `${targetBin}` : `--pid=${targetPID}`], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.setupListeners();

    this.sendCommand('source ./jumps.py');

    //this.sendCommand('handle SIGINT stop nopass');

    this.bps = [];
    this.cleared = true;
    this.ready = true;
    this.bps_line = [];
    this.pid = 0;
  }

  private setupListeners() {
    this.gdb.stdout.on('data', (data) => {
        const output = data.toString();
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
  
  public async SetBreakpointAtLine(file: string, line: number, reset?: boolean) {
    await this.sendCommand(`-break-watch g_tw`);
    
    const obj = this.getJSONObj('^done').wpt;

    const bp = obj.number;
        
        //Now we must find the correct offset for the file
    await this.sendCommand(`set $ptr = vmoffset`)
    await this.sendCommand('-data-evaluate-expression vmoffset->fn');

    let r = this.getJSONObj('^done').value.match(/"([^"]+)"/)[1];

    if(r != file) {
      await this.sendCommand(`set $ptr = $ptr->next`)
      await this.sendCommand('-data-evaluate-expression $ptr->fn');
      r = this.getJSONObj('^done').value.match(/"([^"]+)"/)[1];

      while(r != file) {
        await this.sendCommand(`set $ptr = $ptr->next`)
        await this.sendCommand('-data-evaluate-expression $ptr->fn');
        r = this.getJSONObj('^done').value.match(/"([^"]+)"/)[1];
      }
    }

    await this.sendCommand(`set $offptr = $ptr`);

    await this.sendCommand(`-break-condition ${bp} g_tw == ${line << 12} && $offptr <= (insptr - apScript)`);

    if(!reset)
      this.bps_line.push({ file, line });
  }

  // Run the program inside GDB
  public run() {
    this.sendCommand("run");
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
    await this.sendCommand('-break-delete');
    this.cleared = false;
    this.bps_line.forEach((e) => this.SetBreakpointAtLine(e.file, e.line, true));
    this.sendCommand("-exec-continue");
  }

  public async stepInto() {
    if(!this.cleared) {
      this.sendCommand('set_breaks');
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