import { spawn, ChildProcessWithoutNullStreams } from "child_process";

class LLDBDebugger {
  private lldb: ChildProcessWithoutNullStreams;

  constructor(targetPID: number) {
    this.lldb = spawn("lldb", ["--attach-pid", `${targetPID}`], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.lldb.stdout.on("data", (data) => this.handleOutput(data.toString()));
    this.lldb.stderr.on("data", (data) => console.error("LLDB Error:", data.toString()));

    this.lldb.on("close", (code) => console.log(`LLDB exited with code ${code}`));

    setTimeout(() => this.sendCommand("process continue"), 1000); // Start execution
  }

  private handleOutput(output: string) {
    console.log("LLDB:", output);

    if (output.includes("stop reason")) {
      console.log("The program has stopped.");
    } else if (output.includes("resumed")) {
      console.log("The program is running.");
    }
  }

  public sendCommand(command: string) {
    this.lldb.stdin.write(command + "\n");
  }

  public continueExecution() {
    this.sendCommand("process continue");
  }

  public stepInto() {
    this.sendCommand("thread step-in");
  }

  public stepOver() {
    this.sendCommand("thread step-over");
  }

  public close() {
    this.lldb.stdin.end();
  }
}
