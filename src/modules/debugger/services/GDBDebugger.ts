import { rejects } from "assert";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";

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

    this.gdb = spawn("gdb", ["-i=mi", targetBin ? `${targetBin}` : `--pid=${targetPID}`], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.setupListeners();

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

  public getJSONObj(splitter: string) {
    const buf = this.buffer.split(splitter + ',', 2)[1];
    if(buf.length > 0) {
      const jsonStr = buf.split('[', 2)[1].split(']', 2)[0].replace(/=/g, ':').replace(/\b(\w+)\b(?=\s*:)/g, '"$1"');
      const obj = JSON.parse(jsonStr);
      return obj;
    }

    return null;
  }

  public async getInferiorPIDAsJson(): Promise<string> {
    console.log('Fetching inferiors in JSON format...');
    await this.sendCommand(`-list-thread-groups`);
    
    const obj = this.getJSONObj('^done');
    if(!obj)
      return JSON.stringify({ error: "No PID found" });

    // Parse output as JSON format
    if (obj.pid) {
        console.log('Inferior PID JSON:', obj.pid);
        this.pid = obj.pid;
        return obj.pid;
    } else {
        console.log("No PID found.");
        return JSON.stringify({ error: "No PID found" });
    }
  }
  /*
  public SetBreakpointAtLine(file: string, line: number, reset?: boolean) {
    this.sendAndWait(`watch g_tw`).then(async () => {
        const s = this.lastResponse.search('watchpoint');

        const bp = Number(this.lastResponse.slice(s + String('watchpoint').length + 1, this.lastResponse.indexOf(':')));
        
        //Now we must find the correct offset for the file
        await this.sendAndWait(`set $ptr = vmoffset->offset`)
        await this.sendAndWait('print vmoffset->fn');

        let r = this.lastResponse.substring(this.lastResponse.indexOf('"') + 1, this.lastResponse.length - 1);

        if(r != file) {
            await this.sendAndWait(`print $ptr->fn`);
            r = this.lastResponse.substring(this.lastResponse.indexOf('"') + 1, this.lastResponse.length - 1);

            while(r != file) {
                await this.sendAndWait(`set $ptr = $ptr->of`)
                await this.sendAndWait(`print $ptr->fn`);
                r = this.lastResponse.substring(this.lastResponse.indexOf('"') + 1, this.lastResponse.length - 1);
            }
        }

        this.sendCommand(`condition ${bp} g_tw == ${line << 12} && $ptr->offset > (insptr - apScript)`);

        if(!reset)
          this.bps_line.push({ file, line });
    });
  }
*/
  // Run the program inside GDB
  public run() {
    this.sendCommand("run");
  }

  public pause() {
    process.kill(this.pid, 'SIGINT');
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

  public continueExecution() {
    this.sendCommand('delete');
    this.cleared = false;
    //this.bps_line.forEach((e) => this.SetBreakpointAtLine(e.file, e.line, true));
    this.sendCommand("continue");
  }

  public stepInto() {
    if(!this.cleared)
      this.sendCommand('set_jumps');

    this.sendCommand("continue");
  }

  public stepOver() {
    this.sendCommand("next");
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