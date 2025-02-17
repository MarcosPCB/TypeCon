import process from "process";
import GDBDebugger from "./services/GDBDebugger";
import * as readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function Prompt(d: GDBDebugger) {
    rl.question('> ', async (e) => {
        if(e == 'quit' || e == 'q') {
            await d.sendCommand('quit');
            console.log('Bye bye!');
            rl.close();
            process.exit(0);
        }

        e += ' ';

        switch(e.slice(0, e.indexOf(' '))) {
            case 'continue':
            case 'c':
                d.continueExecution();
                break;

            case 'step':
            case 's':
                d.stepInto();
                break;

            case 'test':
                d.pause();
                //d.SetBreakpointAtLine('EDUKE.CON', 12);
                await d.sendCommand("continue");
                break;

            case 'load':
                await d.sendCommand('source ./jumps.py');
                break;

            case 'cmd':
                await d.sendCommand(e.slice(4, e.length));
                break;

            case 'stop':
                d.pause();
                break;

            case 'start':
                await d.sendCommand('-exec-run --start');
                await d.getInferiorPidAsJson();
                break;

            /*case 'log':
                let n = Number(e.slice(4, e.length - 1));
                if(isNaN(n))
                    n = 0;
                if(n < 0)
                    n = d.log.length + n;
                console.log(d.log[n]);
                break;*/
        }

        await Prompt(d);
    })
}

export function CONDebugger(target: string, PID: boolean) {
    debugger;
    const d = new GDBDebugger(!PID ? target : undefined, PID ? Number(target) : undefined);
    //d.run();

    /*d.sendCommand('start');
    d.sendCommand('info inferiors');
    let p = d.log.at(-2);

    const i = p.indexOf('process ');
    const process = p.slice(i + String('process ').length);
    p = process.slice(0, process.indexOf(' '));
    const pid = Number(p);
    d.pid = pid;*/

    Prompt(d);
}