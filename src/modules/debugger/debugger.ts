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
            d.sendCommand('quit');
            console.log('Bye bye!');
            rl.close();
            process.exit(0);
        }

        e += ' ';

        switch(e.slice(0, e.indexOf(' '))) {
            case 'continue':
            case 'c':
                await d.continueExecution();
                break;

            case 'step':
            case 's':
                await d.stepInto();
                break;

            case 'test':
                await d.pause();
                await d.SetBreakpointAtLine('EDUKE.CON', 12);
                d.sendCommand("-exec-continue");
                break;

            case 'load':
                d.sendCommand('source ./jumps.py');
                break;

            case 'cmd':
                d.sendCommand(e.slice(4, e.length));
                break;

            case 'fullstop':
                d.pause();
                break;

            /*case 'stop':
                d.pause();
                await d.sendCommand('-stack-list-frames');
                const frames = d.getJSONObj('^done', true).stack as Array<any>;
                const f = frames.find(e => e.frame.func == 'VM_Execute');

                if(f) {
                    await d.sendCommand(`-stack-select-frame ${f.frame.level}`);
                    this.sendCommand('set_breaks');
                    d.cleared = true;
                    this.sendCommand("-exec-continue");
                }
                break;*/

            case 'clear':
                await d.sendCommand('-break-delete');
                d.cleared = false;
                d.bps.length = d.bps_line.length = 0;
                break;

            case 'start':
                await d.sendCommand('-exec-run --start');
                await d.getInferiorPIDAsJson();
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