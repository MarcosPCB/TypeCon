import fs from 'fs';
import Parser = require('@babel/parser');
import path = require('path');
import Transpiler from './Transpiler';
import * as T from '@babel/types';

let fileName = '';
let lineDetail = false;
let parse_only = false;
let stack_size = 1024;

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
    const code = Transpiler(parsed, lineDetail, stack_size, file.toString());
    if(code) {
        fs.writeFileSync(`compiled/${path.basename(fileName)}.con`, code);
    }
}

process.exit(0);