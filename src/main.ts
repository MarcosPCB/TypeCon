import fs from 'fs';
import Parser = require('@babel/parser');
import path = require('path');
import Transpiler from './Transpiler';
import * as T from '@babel/types';
import { initCode, initStates } from './translation';

let fileName = '';
let lineDetail = false;
let parse_only = false;
let stack_size = 1024;
let output_folder = './compiled';
let output_file = '';
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

    if(a == '-help') {
        console.log(`Usage: \n\t-c: for the file path to be transpiled \n\t-o: for the output file name \n\t-of: for the output folder path \n\t-p: for parse only \n\t-ld: to write the TS lines inside the CON code \n\t-ss: to define the stack size \n\t-hl: Don't insert the header code (init code and states) inside the transpiled CON \n\t-nh: Don't create the header file \n\t-h: Create the header file \n`)
        process.exit(0);
    }

}

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
    if(compile_options & 4) {
        let header = initCode

        if(!stack_size) header += '1024 0 \n \n' + initStates;
        else header += stack_size + ' 0 \n \n' + initStates;
        fs.writeFileSync(`${output_folder}/header.con`, header);
    }

    const code = Transpiler(parsed, lineDetail, stack_size, file.toString(), compile_options);
    console.log(`Saving to ${output_folder}/${!output_file.length ? path.basename(fileName) : output_file}.con`);
    if(code) {
        fs.writeFileSync(`${output_folder}/${!output_file.length ? path.basename(fileName) : output_file}.con`, code);
    }

    if(code && (compile_options & 4 || compile_options & 2)) {
        console.log(`Creating header and init files...`)
        fs.writeFileSync(`${output_folder}/init.con`,
        `include header.con \ninclude ${!output_file.length ? path.basename(fileName) : output_file}.con`);
    }

    console.log(`Tranpling finished!`);

}

process.exit(0);