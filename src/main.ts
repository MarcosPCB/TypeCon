#!/usr/bin/env node

import fs from 'fs';
import path = require('path');
import { compiledFiles, CONInit } from './modules/transpiler/helper/translation';
import GDBDebugger from './modules/debugger/services/GDBDebugger';
//import { CONDebugger } from './modules/debugger/debugger';
import { TsToConTranspiler } from './modules/transpiler/services/Transpiler2';
import * as readline from 'readline';
import inquirer from 'inquirer';
const fsExtra = require("fs-extra");
import { spawnSync } from 'child_process';
const packConfig = require('../package.json');

let fileName = '';
let lineDetail = false;
let parse_only = false;
let stack_size = 1024;
let output_folder = 'compiled';
let output_file = '';
let linkList: string[] = [];
let files: string[] = [];
let link = false;
let default_inclusion = false;
let eduke_init = false;
let init_file = 'init.con';
let debug_mode = false;
let path_or_PID = '';
let PID = false;
let gdb_log = false;
let gdb_err = false;
let initFunc = false;

/** 
 * Helper function that wraps readline.question into a Promise.
 */
function AskQuestion(query: string): Promise<string> {
    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  
    return new Promise((resolve) => {
      rl.question(query, (answer: string) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  function DetectPackageManager(projectRoot: string): 'yarn' | 'npm' {
    return fs.existsSync(path.join(projectRoot, 'yarn.lock'))
      ? 'yarn'
      : 'npm';
  }
  
  function InstallTypescriptPlugin(projectRoot: string, pluginName: string) {
    const manager = DetectPackageManager(projectRoot);
    const cmd = manager === 'yarn' ? 'yarn' : 'npm';
    const args = manager === 'yarn' 
      ? ['add', '--dev', pluginName] 
      : ['install', '--save-dev', pluginName];
  
    console.log(`Installing ${pluginName} using ${manager}...`);
    const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: projectRoot });
    
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`${manager} install failed with exit code ${result.status}`);
    }

    console.log(`\n✅ Installed ${pluginName} successfully.`);
  }

async function Setup() {

    let folder = '';
    //try {
        //folder = await askQuestion(`What's your source code folder name? e.g: src`);
        let  answer = await inquirer.prompt(
            {
              type: 'input',
              name: 'choice',
              message: "What's your source code folder name? e.g: src"
            });

        if(!answer.choice)
            console.log(`Using default src folder...`);

        folder = answer.choice;
    /*} catch(err) {
        console.log(`ERROR: reading input error`, err);
        process.exit(1);
    }*/

    try {
        console.log(`Creating folder ${folder}...`);
        fs.mkdirSync(`./${folder}`);
    } catch(err) {
        console.log(`ERROR: unable to create folder ${folder}`, err);
        process.exit(1);
    }

    try {
        console.log(`Setting up include folder and files...`);
        fs.mkdirSync(`./${folder}/include`);
        const incFolder = path.join(__dirname, '..', 'include');
        const prjFolder = path.join(process.cwd(), folder, 'include');
        await fsExtra.copy(incFolder, prjFolder, { overwrite: true });
    } catch(err) {
        console.log(`ERROR: unable to copy files ${path.join(process.cwd(), folder, 'include')}`, err);
        process.exit(1);
    }

    console.log(`Source files copied!`);

    try {
        InstallTypescriptPlugin(process.cwd(), 'typescript');
        InstallTypescriptPlugin(process.cwd(), 'typecon_plugin');
        console.log(`Setting up TypeScript enviroment...`);
        fs.writeFileSync(`tsconfig.json`, JSON.stringify({
            compilerOptions: {
                plugins: [
                    {
                        name: `typecon_plugin`
                    }
                ],
                strict: true,
            },
            include: ["data/**/*.ts"],
            exclude: ["node_modules"]
        }));
    } catch(err) {
        console.log(`ERROR: basic TS setup failed`, err);
        process.exit(1);
    }

    console.log(`TypeCON enviroment is ready!`);

    answer = await inquirer.prompt({
        type: 'list',
        name: 'choice',
        message: `What template would you like to use? Use 'None' if you're not setting up this right now`,
        choices: ['DN3D mod', 'Basic', 'None'],
        default: 'None'
    });

    switch(answer.choice) {
        case 'DN3D mod':
            break;

        case 'Basic':
            break;

        case 'None':
            break;
    }

    console.log(`Setup is completed!`);

    console.log(`
    ---------------------------------------------
    To enable the plugin in VS Code, set the TypeScript version to the one in this project
    and restart the TS server:
      1. Press Ctrl+Shift+P (or Cmd+Shift+P on Mac).
      2. Choose "TypeScript: Select TypeScript version..."
      3. Choose "TypeScript: Restart TS Server".
    ---------------------------------------------
    `);

    process.exit(0);
}

/*
    1 - don't put header in the CONs
    2 - don't create header file
    4 - create header file once
    8 - output all to one file
*/
let compile_options = 0;

console.log(`\n\x1b[36mTypeCON Compiler \x1b[93mBETA\x1b[0m \x1b[92mVersion ${packConfig.version}\x1b[0m\x1b[94m
By ItsMarcos\x1b[0m - Use \x1b[95m'--help or -?'\x1b[0m to get the list of commands`)

if(!fs.existsSync('compiled'))
    fs.mkdirSync('compiled');

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

    if(a == `-gdblog`)
        gdb_log = true;

    if(a == `-gdberr`)
        gdb_err = true;

    if(a == '--input' || a == '-i') {
        fileName = process.argv[i + 1];

        if(!fs.existsSync(fileName))
            process.exit(1);
    }

    if(a == '--detail_lines' || a == '-dl')
        lineDetail = true;

    if(a == '--stack_size' || a == '-ss')
        stack_size = Number(process.argv[i + 1]);

    if(a == '--output_folder' || a == '-of')
        output_folder = process.argv[i + 1];

    if(a == '--output' || a == '-o')
        output_file = process.argv[i + 1];

    if(a == '--headerless' || a == '-hl')
        compile_options |= 1;

    if(a == '--header' || a == '-h') {
        if(compile_options & 2) {
            console.log(`ERROR: you can't use -h with -nh parameters together`);
            process.exit(1);
        }
        compile_options |= 4 + 1;
    }

    if(a == '--one_file' || a == '-1f') {
        if(compile_options & 4) {
            console.log(`ERROR: you can't use -1f with -h parameter`)
            process.exit(1);
        }

        if(!output_file.length) {
            console.log(`ERROR: you must provide a name for the output file when using -1f`)
            process.exit(1);
        }

        compile_options |= 8;
    }

    if(a == '--link' || a == '-l') {
        link = true;
        for(let j = i + 1; j < process.argv.length; j++) {
            const arg = process.argv[j];
            if(arg.charAt(0) == '"' && arg.charAt(-1) == '"')
                linkList.push(arg);
            else break;
        }
    }

    if(a == '--input_list' || a == '-il') {
        link = true;
        for(let j = i + 1; j < process.argv.length; j++) {
            const arg = process.argv[j];
            if(arg.charAt(0) == '"' && arg.charAt(-1) == '"')
                files.push(arg);
            else break;
        }
    }

    if(a == '--default_inclusion' || a == '-di')
        default_inclusion = true;

    if(a == '--eduke_init' || a == '-ei') {
        eduke_init = true;
        init_file = 'EDUKE.CON';
    }

    if(a == 'setup') {
        initFunc = true;
        Setup();
    }

    if(a == '--help' || a == '-?') {
        console.log(`
Usage:
    Compile options:
    \x1b[31m-i or --input\x1b[0m:  for the file path to be compiled
    \x1b[32m-il or --input_list\x1b[0m: for a list of files to be compiled
    \x1b[33m-o or --output\x1b[0m:  for the output file name
    \x1b[34m-of or --output_folder\x1b[0m: for the output folder path 
    \x1b[35m-dl or --detail_lines\x1b[0m: to write the TS lines inside the CON code 
    \x1b[36m-ss or --stack_size\x1b[0m: to define the stack size 
    \x1b[91m-hl or --headerless\x1b[0m: Don't insert the header code (init code and states) inside the output CON 
    \x1b[92m-h or --header\x1b[0m: Create the header file 
    \x1b[93m-l or --link\x1b[0m: Create the header and the init files with the following list of CON files (separated by "")
    \x1b[96m-1f or --one_file\x1b[0m: Compile all the code into one file (must be used with -o)
    \x1b[94m-di or --default_inclusion\x1b[0m: Default inclusion (GAME.CON) 
    \x1b[95m-ei or --eduke_init\x1b[0m: Init file is EDUKE.CON

    Project options:
    \x1b[31msetup\x1b[0m: Creates the project's basic setup including folders, include files, templates and the basic TypeScript configuration`)
        process.exit(0);
    }
}

if(debug_mode) {
    //CONDebugger(path_or_PID, PID, gdb_log, gdb_err);
} else if(!initFunc) {
    if(stack_size < 1024)
        console.log(`WARNING: using a stack size lesser than 1024 is not recommended!`);

    const transpiler = new TsToConTranspiler({lineDetail});

    let code = '';

    const initSys = new CONInit(stack_size);

    if(fileName != '') {
        const file = fs.readFileSync(fileName);

        const result = transpiler.transpile(file.toString(), fileName);

        for(let i = compiledFiles.size - 1; i >= 0; i--) {
            const f = compiledFiles.get(Array.from(compiledFiles.keys())[i]);
            code += f.code;
        }

        fileName = GetOutputName(fileName);

        if(compile_options & 4) {
            CreateInit([`${output_folder}/${fileName}.con`]);
            console.log(`Writing header file: ${output_folder}/header.con`);
            fs.writeFileSync(`${output_folder}/header.con`, initSys.BuildInitFile());

            console.log(`Writing ${output_folder}/${fileName}.con`);
            fs.writeFileSync(`${output_folder}/${fileName}.con`, code);
        } else {
            if(default_inclusion)
                code = `include GAME.CON\n\n` + initSys.BuildFullCodeFile(code);
            else {
                if(!(compile_options & 1))
                    code = initSys.BuildFullCodeFile(code);
            }

            console.log(`Writing ${output_folder}/${fileName}.con`);
            fs.writeFileSync(`${output_folder}/${fileName}.con`, code);
        }
    }

    if(files.length > 0) {
        for(const f of files) {
            const file = fs.readFileSync(f);

            transpiler.transpile(file.toString(), f);
        }

        if(compile_options & 8) {
            console.log(`Compiling into one file...`);
            for(let i = compiledFiles.size - 1; i >= 0; i--) {
                const f = compiledFiles.get(Array.from(compiledFiles.keys())[i]);
                code += f.code;
            }

            if(!(compile_options & 1))
                code = initSys.BuildFullCodeFile(code);

            console.log(`Writing ${output_folder}/${output_file}.con`);
            fs.writeFileSync(`${output_folder}/${output_file}.con`, code);
        } else {
            compiledFiles.forEach(c => {
                const name = GetOutputName(c.path);
                console.log(`Writing ${output_folder}/${name}.con`);
                fs.writeFileSync(`${output_folder}/${name}.con`, c.code);

                if(compile_options & 4)
                    linkList.push(`${output_folder}/${name}.con`);
            });

            if(compile_options & 4)
                link = true;
        }
    }

    if(link) {
        console.log(`Linking...`);
        CreateInit(linkList);
        console.log(`Writing header file: ${output_folder}/header.con`);
        fs.writeFileSync(`${output_folder}/header.con`, initSys.BuildInitFile());
    }

    if(fileName == '' && files.length == 0 && !link)
        console.log(`Nothing to do!`);
    else
        console.log(`Compilation finished!`);

    process.exit(0);
}

function CreateInit(outputFiles: string[]) {
    let code = '';

    console.log(`Writing init file: ${init_file}`);

    if(default_inclusion)
        code = `include GAME.CON\n\n`;

    code = `include header.con\n`;

    for(const o of outputFiles)
        code += `include ${o}.con\n`

    fs.writeFileSync(`${output_folder}/${init_file}`, code);
}

function GetOutputName(filename: string) {
    if(output_file.length > 0)
        return output_file;

    //Remove extension
    const ext = path.extname(filename);
    const final = path.basename(filename);

    if(ext != '')
        return final.slice(0, final.length - ext.length);

    return final;
}