import { rejects } from "assert";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";

export default class GDBDebugger {
  private gdb: ChildProcessWithoutNullStreams;
  public lastResponse: string;
  public ready: boolean;
  public bps: number[];
  public cleared: boolean;
  public bps_line: { file: string, line: number }[];

  constructor(targetBin?: string, targetPID?: number) {
    if(!targetBin && !targetPID)
      throw 'You must specify a binary path OR a PID to be debugger';

    this.gdb = spawn("gdb", ["-i=mi", targetBin ? `"${targetBin}"` : `--pid=${targetPID}`], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.gdb.stdout.on("data", (data) => { this.handleOutput(data.toString()); this.ready = true; });
    this.gdb.stderr.on("data", (data) => console.error("GDB Error:", data.toString()));

    this.gdb.on("close", (code) => console.log(`GDB exited with code ${code}`));

    this.sendCommand('source set_jumps.py');

    this.bps = [];
    this.cleared = true;
    this.ready = true;
    this.bps_line = [];
  }

  private handleOutput(output: string) {
    console.log("GDB:", output); // Log all responses for now

    this.lastResponse = output;

    if (output.includes("*stopped")) {
      console.log("The program has stopped.");
    } else if (output.includes("^running")) {
      console.log("The program is running.");
    }
  }

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

  // Run the program inside GDB
  public run() {
    this.sendCommand("run");
}

  public sendCommand(command: string) {
    this.ready = false;
    this.gdb.stdin.write(command + "\n");
  }

  public async sendAndWait(command: string) {
    const sleep = (ms: any) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    this.sendCommand(command);
    
    while(!this.ready)
      await sleep(50);

    return this.ready;
  }

  public continueExecution() {
    this.sendCommand('delete');
    this.cleared = false;
    this.bps_line.forEach((e) => this.SetBreakpointAtLine(e.file, e.line, true));
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