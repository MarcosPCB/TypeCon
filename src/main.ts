import fs from 'fs';
import Parser = require('@babel/parser');
import path = require('path');
import Transpiler from './modules/transpiler/services/Transpiler';
import * as T from '@babel/types';
import { initCode, initStates } from './modules/transpiler/helper/translation';
import GDBDebugger from './modules/debugger/services/GDBDebugger';
import { CONDebugger } from './modules/debugger/debugger';

let fileName = '';
let lineDetail = false;
let parse_only = false;
let stack_size = 1024;
let output_folder = './compiled';
let output_file = '';
let linkList: string[] = [];
let link = false;
let default_inclusion = false;
let eduke_init = false;
let init_file = 'init.con';
let debug_mode = false;
let path_or_PID = '';
let PID = false;

/*
    1 - don't put header in the CONs
    2 - don't create header file
    4 - create header file once
*/
let compile_options = 0;

console.log(`TypeCON Transpiler BETA Version 0.01 \nBy ItsMarcos - Use '-help' to get the list of commands \n`)

if(!fs.existsSync('./obj'))
    fs.mkdirSync('./obj');

if(!fs.existsSync('./compiled'))
    fs.mkdirSync('./compiled');

for(let i = 0; i < process.argv.length; i++) {
    const a = process.argv[i];

    //If enabled, it ignores all the other stuff
    if(a == '-debug') {
        debug_mode = true;
        const arg = process.argv[i + 1];
        if(arg.startsWith('PID=')) {
            PID = true;
            path_or_PID = arg.slice(4, arg.length);
        } else path_or_PID = arg;
        break;
    }

    if(a == '-c') {
        fileName = process.argv[i + 1];

        if(!fs.existsSync(fileName))
            process.exit(1);
    }

    if(a == '-ld')
        lineDetail = true;

    if(a == '-p')
        parse_only = true;

    if(a == '-ss')
        stack_size = Number(process.argv[i + 1]);

    if(a == '-of')
        output_folder = process.argv[i + 1];

    if(a == '-o')
        output_file = process.argv[i + 1];

    if(a == '-hl')
        compile_options |= 1;

    if(a == '-nh') {
        if(compile_options & 4) {
            console.log(`ERROR: you can't use -nh with -h parameters together`);
            process.exit(1);
        }
        compile_options |= 2 + 1;
    }

    if(a == '-h') {
        if(compile_options & 2) {
            console.log(`ERROR: you can't use -h with -nh parameters together`);
            process.exit(1);
        }
        compile_options |= 4 + 1;
    }

    if(a == '-l') {
        link = true;
        for(let j = i + 1; j < process.argv.length; j++) {
            const arg = process.argv[j];
            if(arg.charAt(0) == '"' && arg.charAt(-1) == '"')
                linkList.push(arg);
            else break;
        }
    }

    if(a == '-di')
        default_inclusion = true;

    if(a == '-ei') {
        eduke_init = true;
        init_file = 'EDUKE.CON';
    }

    if(a == '-help') {
        console.log(`Usage: \n\t-c: for the file path to be transpiled \n\t-o: for the output file name \n\t-of: for the output folder path \n\t-p: for parse only \n\t-ld: to write the TS lines inside the CON code \n\t-ss: to define the stack size \n\t-hl: Don't insert the header code (init code and states) inside the transpiled CON \n\t-nh: Don't create the header file \n\t-h: Create the header file \n\t-l create the header and create the init file with the following list of CON files (separated by "") \n\t-di: Default inclusion (GAME.CON) \n\t-ei: Init file is EDUKE.CON`)
        process.exit(0);
    }
}

if(debug_mode) {
    CONDebugger(path_or_PID, PID);
} else {
    if(stack_size < 1024)
        console.log(`WARNING: using a stack size lesser than 1024 is not recommended!`);

    console.log(`Parsing ${fileName}`);

    const file = fs.readFileSync(fileName);

    const parsed: T.File = Parser.parse(file.toString(), {
        sourceType: 'module',
        plugins: [ 'typescript' ],
        tokens: false,
        });

    fs.writeFileSync(`obj/${path.basename(fileName)}.AST`, JSON.stringify(parsed, null, "\t"));

    if(!parse_only) {
        debugger;
        console.log(`Transpiling...`);
        let code = Transpiler(parsed, lineDetail, stack_size, file.toString(), compile_options);

        if(default_inclusion && !(compile_options & 1) && !(compile_options & 2) && !(compile_options & 4) && !link)
            code = `include GAME.CON \n` + code;

        console.log(`Saving to ${output_folder}/${!output_file.length ? path.basename(fileName) : output_file}.con`);
        if(code) {
            fs.writeFileSync(`${output_folder}/${!output_file.length ? path.basename(fileName) : output_file}.con`, code);
        }

        if(code && ((compile_options & 4) || link)) {
            if(compile_options & 4)
                console.log(`Creating header and init files...`);

            if(link)
                console.log('Linking files into the init file...');

            let header = initCode

            if(!stack_size) header += '1024 0 \n \n' + initStates;
            else header += stack_size + ' 0 \n \n' + initStates;
            fs.writeFileSync(`${output_folder}/header.con`, header);

            if(compile_options & 4)
                fs.writeFileSync(`${output_folder}/${init_file}`,
                `${default_inclusion ? 'include GAME.CON \n' : ''}include header.con \ninclude ${!output_file.length ? path.basename(fileName) : output_file}.con`);
            else if(link) {
                let init = `${default_inclusion ? 'include GAME.CON \n' : ''}include header.con \n`;
                init += linkList.map(e => {
                    return `include ${e}`;
                }).join(' \n');

                fs.writeFileSync(`${output_folder}/${init_file}`, init);
                console.log('Link completed!');
            }
        }

        console.log(`Transpiling finished!`);

    }

    process.exit(0);
}