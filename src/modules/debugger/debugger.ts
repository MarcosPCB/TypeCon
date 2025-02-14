import GDBDebugger from "./services/GDBDebugger";
import * as readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function Prompt(d: GDBDebugger) {
    rl.question('> ', (e) => {
        if(e == 'quit' || e == 'q') {
            d.sendCommand('quit');
            console.log('Bye bye!');
            rl.close();
            process.exit(0);
        }

        switch(e) {
            case 'continue':
            case 'c':
                d.continueExecution();
                break;

            case 'step':
            case 's':
                d.stepInto();
                break;
        }

        Prompt(d);
    })
}

export function CONDebugger(target: string, PID: boolean) {
    const d = new GDBDebugger(!PID ? target : undefined, PID ? Number(target) : undefined);

    d.SetBreakpointAtLine('EDUKE.CON', 12);

    Prompt(d);
}