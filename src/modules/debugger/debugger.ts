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

        let args: string[] = [];

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
                await d.SetBreakpointAtLine('test/game.CON', 3304);
                d.sendCommand("-exec-continue");
                break;

            case 'break-line':
                await d.pause();
                args = e.slice(String('break-line').length + 1, e.length).split(' ');
                await d.SetBreakpointAtLine(args[0], Number(args[1]));
                d.sendCommand('-exec-continue');
                break;

            case 'clear-break-line':
                await d.pause();
                args = e.slice(String('clear-break-line').length + 1, e.length).split(' ');
                await d.UnsetBreakpointAtLine(args[0], Number(args[1]));
                d.sendCommand('-exec-continue');
                break;

            case 'list-files':
                console.log(d.scriptFilenames.join(', '));
                break;

            case 'cmd':
                d.sendCommand(e.slice(4, e.length));
                break;

            case 'fullstop':
                d.pause(true);
                break;

            case 'stop':
                d.pause();
                await d.stepInto();
                break;

            case 'clear':
                await d.RemoveAllLineBreapoints();
                await d.sendCommand('-break-delete');
                d.cleared = false;
                d.bps.length = d.bps_line.length = 0;
                break;

            case 'print-lines': 
                args = e.slice(String('print-lines').length + 1, e.length).split(' ');
                let num_lines = 6;
                num_lines = isNaN(Number(args[0])) ? 6 : Number(args[0]);

                await d.PrintWhereItStopped(num_lines);
                break;

            case 'print-var': 
                args = e.slice(String('print-var').length + 1, e.length).split(' ');

                let type = isNaN(Number(args[1])) ? 0 : Number(args[1]);

                await d.GetCurrentGameVarValue(args[0], type);
                break;

            case 'print-array': 
                args = e.slice(String('print-var').length + 1, e.length).split(' ');

                let index = isNaN(Number(args[1])) ? 0 : Number(args[1]);

                await d.GetCurrentGameArrayValue(args[0], index);
                break;

            case 'dump-vars':
                d.sendCommand('call Gv_DumpValues()');
                break;

            case 'info':
                d.sendCommand('call VM_ScriptInfo()');
                break;

            case 'start':
                await d.firstStart();
                d.sendCommand('-exec-continue');
                break;

            case `con`:
                args = e.slice(String('con').length + 1, e.length).split(' ');
                await d.ExecuteCON(args.join(` `));
                break;

            case `render`:
                await d.Data(`"videoNextPage()"`);
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
    const d = new GDBDebugger(!PID ? target : undefined, PID ? Number(target) : undefined, true);
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