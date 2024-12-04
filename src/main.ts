import fs from 'fs';
import Parser = require('@babel/parser');
import path = require('path');
import Transpiler from './Transpiler';
import * as T from '@babel/types';

let fileName = '';
let lineDetail = false;
let parse_only = false;

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

}

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
    const code = Transpiler(parsed, lineDetail, 1024, file.toString());
    if(code) {
        fs.writeFileSync(`compiled/${path.basename(fileName)}.con`, code);
    }
}

process.exit(0);