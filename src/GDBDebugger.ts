import { spawn, ChildProcessWithoutNullStreams } from "child_process";

export default class GDBDebugger {
  private gdb: ChildProcessWithoutNullStreams;

  constructor(targetPID: number) {
    this.gdb = spawn("gdb", ["-i=mi", `--pid=${targetPID}`], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.gdb.stdout.on("data", (data) => this.handleOutput(data.toString()));
    this.gdb.stderr.on("data", (data) => console.error("GDB Error:", data.toString()));

    this.gdb.on("close", (code) => console.log(`GDB exited with code ${code}`));
  }

  private handleOutput(output: string) {
    console.log("GDB:", output); // Log all responses for now

    if (output.includes("*stopped")) {
      console.log("The program has stopped.");
    } else if (output.includes("^running")) {
      console.log("The program is running.");
    }
  }

  public sendCommand(command: string) {
    this.gdb.stdin.write(command + "\n");
  }

  public continueExecution() {
    this.sendCommand("-exec-continue");
  }

  public stepInto() {
    this.sendCommand("-exec-step");
  }

  public stepOver() {
    this.sendCommand("-exec-next");
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