import process from "process";
import GDBDebugger from "./services/GDBDebugger";
import * as readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const helpText = `
\x1b[1;36mCON Debugger Commands Help\x1b[0m

\x1b[1;31mIMPORTANT:\x1b[0m Before executing any commands, you must first run: \x1b[1;33mstart\x1b[0m

\x1b[1;32mExecution Control:\x1b[0m
  \x1b[1;34mcontinue / c\x1b[0m → Resumes execution from the current point.
  \x1b[1;34mstep / s\x1b[0m → Executes the next instruction.
  \x1b[1;34mstop\x1b[0m → Pauses execution at the first VM instruction executed.
  \x1b[1;34mfullstop\x1b[0m → Completely halts execution.

\x1b[1;33mBreakpoints:\x1b[0m
  \x1b[1;35mbreak-line <file> <line>\x1b[0m → Sets a breakpoint at a specific line in a file.
  \x1b[1;35mclear-break-line <file> <line>\x1b[0m → Removes a breakpoint from a specific line.
  \x1b[1;35mclear\x1b[0m → Removes all line breakpoints.

\x1b[1;34mInformation & Debugging:\x1b[0m
  \x1b[1;36mprint-lines [n]\x1b[0m → Displays the last n lines of execution (default: 6).
  \x1b[1;36mprint-var <name> [type]\x1b[0m → Prints the value of a game variable.
  \x1b[1;36mprint-array <name> <index>\x1b[0m → Prints the value of a game array at a given index.
  \x1b[1;36mdump-vars\x1b[0m → Calls Gv_DumpValues(), dumping all variable values.
  \x1b[1;36minfo\x1b[0m → Calls VM_ScriptInfo(insptr, 64), showing script details.
  \x1b[1;36mset-err\x1b[0m → Enable/disable Standard ERR for GDB (if you wanna look into Eduke32 Log messages keep this true)

\x1b[1;35mScript Execution & Debugging:\x1b[0m
  \x1b[1;33mlist-files\x1b[0m → Lists all script files currently loaded.
  \x1b[1;33mcmd <gdb command>\x1b[0m → Executes a raw GDB command.
  \x1b[1;33mstart\x1b[0m → Starts execution and continues immediately.
  \x1b[1;33mcon <CON command>\x1b[0m → Executes a CON script command in the game (BE CAREFUL - UNSAFE).
  \x1b[1;33mrender\x1b[0m → Calls "videoNextPage()" to refresh the screen.
  \x1b[1;33mquit / q\x1b[0m → Closes Eduke32 and exits the debugger.

\x1b[1;31mVariable/label Manipulation (you can use decimal numbers as well):\x1b[0m
  \x1b[1;32msetgg <var> <value> <operation>\x1b[0m → Global variable, global scope.
  \x1b[1;32msetgp <var> <value> <operation>\x1b[0m → Global variable, player scope.
  \x1b[1;32msetga <var> <value> <operation>\x1b[0m → Global variable, actor scope.
  \x1b[1;32msetpg <var> <value> <operation>\x1b[0m → Player variable, global scope.
  \x1b[1;32msetpp <var> <value> <operation>\x1b[0m → Player variable, player scope.
  \x1b[1;32msetpa <var> <value> <operation>\x1b[0m → Player variable, actor scope.
  \x1b[1;32msetag <var> <value> <operation>\x1b[0m → Actor variable, global scope.
  \x1b[1;32msetap <var> <value> <operation>\x1b[0m → Actor variable, player scope.
  \x1b[1;32msetaa <var> <value> <operation>\x1b[0m → Actor variable, actor scope.
`;

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
            case `set-err`:
                args = e.slice(String('set-err').length + 1, e.length).split(' ');
                d.err = Boolean(args[0]);
                console.log(`GDB Standard ERR is ${d.err}`);
                break;

            case 'continue':
            case 'c':
                await d.continueExecution();
                break;

            case 'step':
            case 's':
                await d.stepInto();
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
                await d.pause();
                await d.stepInto();
                break;

            case 'clear':
                await d.pause();
                await d.RemoveAllLineBreapoints();
                await d.sendCommand('-break-delete');
                d.cleared = false;
                d.bps.length = d.bps_line.length = 0;
                break;

            case 'print-lines': 
                await d.pause();
                args = e.slice(String('print-lines').length + 1, e.length).split(' ');
                let num_lines = 6;
                num_lines = isNaN(Number(args[0])) ? 6 : Number(args[0]);

                if(num_lines <= 0)
                    num_lines = 6;

                await d.PrintWhereItStopped(num_lines);
                break;

            case 'print-var': 
                await d.pause();
                args = e.slice(String('print-var').length + 1, e.length).split(' ');

                let type = isNaN(Number(args[1])) ? 0 : Number(args[1]);

                await d.GetCurrentGameVarValue(args[0], type);
                break;

            case 'print-array': 
                await d.pause();
                args = e.slice(String('print-var').length + 1, e.length).split(' ');

                let index = isNaN(Number(args[1])) ? 0 : Number(args[1]);

                await d.GetCurrentGameArrayValue(args[0], index);
                break;

            case 'dump-vars':
                await d.pause();
                d.sendCommand('call Gv_DumpValues()');
                break;

            case 'info':
                await d.pause();
                d.sendCommand('call VM_ScriptInfo(insptr, 64)');
                break;

            case 'start':
                await d.firstStart();
                d.sendCommand('-exec-continue');
                break;

            case `con`:
                let cont = d.paused;
                
                await d.pause();
                if(cont)
                    await d.stepInto();

                args = e.slice(String('con').length + 1, e.length).split(' ');
                await d.ExecuteCON(args.join(` `));

                if(!cont)
                    await d.continueExecution();
                break;

            case `setgg`:
                await d.pause();
                args = e.slice(String('setgg').length + 1, e.length).split(' ');
                await d.VariableOperations(args[0], args[2], args[1], 0, 0);
                break;

            case `setgp`:
                await d.pause();
                args = e.slice(String('setgg').length + 1, e.length).split(' ');
                await d.VariableOperations(args[0], args[2], args[1], 0, 1);
                break;

            case `setga`:
                await d.pause();
                args = e.slice(String('setgg').length + 1, e.length).split(' ');
                await d.VariableOperations(args[0], args[2], args[1], 0, 2);
                break;

            case `setpg`:
                await d.pause();
                args = e.slice(String('setgg').length + 1, e.length).split(' ');
                await d.VariableOperations(args[0], args[2], args[1], 1, 0);
                break;

            case `setpp`:
                await d.pause();
                args = e.slice(String('setgg').length + 1, e.length).split(' ');
                await d.VariableOperations(args[0], args[2], args[1], 1, 1);
                break;

            case `setpa`:
                await d.pause();
                args = e.slice(String('setgg').length + 1, e.length).split(' ');
                await d.VariableOperations(args[0], args[2], args[1], 1, 2);
                break;

            case `setag`:
                await d.pause();
                args = e.slice(String('setgg').length + 1, e.length).split(' ');
                await d.VariableOperations(args[0], args[2], args[1], 2, 0);
                break;

            case `setap`:
                await d.pause();
                args = e.slice(String('setgg').length + 1, e.length).split(' ');
                await d.VariableOperations(args[0], args[2], args[1], 2, 1);
                break;

            case `setaa`:
                await d.pause();
                args = e.slice(String('setgg').length + 1, e.length).split(' ');
                await d.VariableOperations(args[0], args[2], args[1], 2, 2);
                break;

            case `render`:
                await d.pause();
                await d.Data(`"videoNextPage()"`);
                break;

            case 'help':
                console.log(helpText);
                break;
        }

        await Prompt(d);
    })
}

export function CONDebugger(target: string, PID: boolean, gdbLog: boolean, gdbErr: boolean) {
    debugger;
    const d = new GDBDebugger(!PID ? target : undefined, PID ? Number(target) : undefined, gdbLog, gdbErr);
    console.log(helpText);
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