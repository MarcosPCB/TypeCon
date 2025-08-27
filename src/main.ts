#!/usr/bin/env node

import fs, { Dirent } from 'fs';
import path = require('path');
import { compiledFiles, CONInit } from './modules/compiler/framework';
import { CompileResult, TsToConCompiler } from './modules/compiler/Compiler';
import inquirer from 'inquirer';
const fsExtra = require("fs-extra");
import { spawnSync } from 'child_process';
const packConfig = require('../package.json');
import https from 'https';
import semver from 'semver';

let fileName = '';
let input_folder = '';
let line_print = false;
let symbol_print = false;
let stack_size = 1024;
let output_folder = 'compiled';
let output_file = '';
let linkList: string[] = [];
let files: string[] = [];
let link = false;
let default_inclusion = false;
let init_file = 'init.con';
let initFunc = false;
let precompiled_modules = true;
let heap_page_size = 4;
let heap_page_number = 128;

export function colorText(text: string, color: 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | string) {
    switch (color) {
        case 'red':
            color = '31';
            break;
        case 'green':
            color = '32';
            break;
        case 'yellow':
            color = '33';
            break;
        case 'blue':
            color = '34';
            break;
        case 'magenta':
            color = '35';
            break;
        case 'cyan':
            color = '36';
            break;
        case 'white':
            color = '37';
            break;
    }
    return `\x1b[${color}m${text}\x1b[0m`;
}

const helpText = `
Usage:
    Project options:
    \x1b[31msetup\x1b[0m: Creates the project's basic setup including folders, include files, templates and the basic TypeScript configuration

    Compile options:
    \x1b[31m-i or --input\x1b[0m:  for the file path to be compiled
    \x1b[37m-if or --input_folder\x1b[0m:  for the path folder to be compiled (compiles all files inside)
    \x1b[32m-il or --input_list\x1b[0m: for a list of files to be compiled
    \x1b[33m-o or --output\x1b[0m:  for the output file name
    \x1b[34m-of or --output_folder\x1b[0m: for the output folder path 
    \x1b[35m-dl or --detail_lines\x1b[0m: to write the TS lines inside the CON code 
    \x1b[36m-ss or --stack_size\x1b[0m: to define the stack size 
    \x1b[36m-hs or --heap_size\x1b[0m: to define the heap's size
    \x1b[38m-ps or --page_size\x1b[0m: to define the heap page's minimum size 
    \x1b[39m-pn or --page_number\x1b[0m: to define the default number of heap pages
    \x1b[91m-hl or --headerless\x1b[0m: Don't insert the header code (init code and states) inside the output CON 
    \x1b[92m-h or --header\x1b[0m: Create the header file 
    \x1b[96m-np or --no_precompiled\x1b[0m: Don't link pre-compiled modules
    \x1b[93m-l or --link\x1b[0m: Create the header and the init files with the following list of CON files (separated by "")
    \x1b[96m-1f or --one_file\x1b[0m: Compile all the code into one file (must be used with -o)
    \x1b[94m-di or --default_inclusion\x1b[0m: Default inclusion (GAME.CON) 
    \x1b[95m-ei or --eduke_init\x1b[0m: Init file is EDUKE.CON`



const currentVersion = packConfig.version;
const packageName = packConfig.name;

function checkForUpdates() {
    https.get(`https://registry.npmjs.org/${packageName}/latest`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const latest = JSON.parse(data).version;
                if (semver.gt(latest, currentVersion)) {
                    const isCrucial = semver.diff(currentVersion, latest) === 'minor';
                    console.log(`\x1b[33mA new version (${latest}) is available!${isCrucial ? ' This is a crucial update.' : ''}\x1b[0m`);
                }
            } catch (e) { }
        });
    });
}

function GetAllFilesFromPath(iPath: string) {
    let iFiles: Dirent[];

    try {
        iFiles = fs.readdirSync(iPath, {
            withFileTypes: true
        });
    } catch (err) {
        console.log(`Path ${iPath} is not valid or is not a folder`);
        return;
    }

    if (iFiles.length == 0)
        return;

    for (const f of iFiles) {
        if (f.isFile()) {
            files.push(path.join(f.parentPath, f.name));
            console.log(`Added ${path.join(f.parentPath, f.name)} to compile list`);
        }

        if (f.isDirectory())
            GetAllFilesFromPath(path.join(f.parentPath, f.name));
    }
}

function DetectPackageManager(projectRoot: string): 'yarn' | 'npm' {
    return fs.existsSync(path.join(projectRoot, 'yarn.lock'))
        ? 'yarn'
        : fs.existsSync(path.join(projectRoot, 'package.json')) ?'npm' : null;
}

async function InstallTypescriptPlugin(projectRoot: string, pluginName: string) {
    let manager = DetectPackageManager(projectRoot);
    if(!manager) {
        console.log(colorText(`No package manager found in ${projectRoot}`, 'yellow'));
        let answer = await inquirer.prompt({
            type: 'list',
            name: 'choice',
            message: 'Would you like to initialize a new yarn/npm project?',
            choices: ['yarn', 'npm', 'cancel'],
            default: 'yarn'
        });

        if(answer.choice === 'cancel') {
            console.log(colorText('Aborting...', 'magenta'));
            process.exit(1);
        }
        
        if(answer.choice === 'yarn') {
            console.log(colorText('Initializing yarn project...', 'magenta'));
            const result = await spawnSync('yarn', ['init', '-y'], { stdio: 'inherit', cwd: projectRoot, shell: true });

            if(result.status !== 0) {
                console.log(colorText('An error occurred during yarn initialization', 'red'));
                process.exit(1);
            }

            manager = 'yarn';
        } else if(answer.choice === 'npm') {
            console.log(colorText('Initializing npm project...', 'magenta'));
            const result = await spawnSync('npm', ['init', '-y'], { stdio: 'inherit', cwd: projectRoot, shell: true });
            if(result.status !== 0) {
                console.log(colorText('An error occurred during yarn initialization', 'red'));
                process.exit(1);
            }

            manager = 'npm';
        }
    }
    // Use .cmd extension on Windows for npm/yarn
    const isWin = process.platform === 'win32';
    const cmd = manager === 'yarn'
        ? (isWin ? 'yarn' : 'yarn')
        : (isWin ? 'npm' : 'npm');
    const args = manager === 'yarn'
        ? ['add', '--dev', pluginName]
        : ['install', '--save-dev', pluginName];

    console.log(`Installing ${pluginName} using ${manager} at ${projectRoot}...`);
    const result = await spawnSync(cmd, args, { stdio: 'inherit', cwd: projectRoot, shell: true });

    if (result.error)
        throw result.error;
    
    if (result.status !== 0)
        throw new Error(`${manager} install failed with exit code ${result.status}`);
    

    console.log(`\n✅ Installed ${pluginName} successfully.`);
}

async function Setup() {
    let folder = '';
    let answer = await inquirer.prompt(
        {
            type: 'input',
            name: 'choice',
            message: "What's your source code folder name? e.g: src:",
            default: 'src'
        });

    if (!answer.choice)
        console.log(`Using default src folder...`);

    folder = answer.choice;

    try {
        console.log(`Creating folder ${folder}...`);
        if (!fs.existsSync(`${process.cwd()}/${folder}`))
            fs.mkdirSync(`${process.cwd()}/${folder}`);
    } catch (err) {
        console.log(`ERROR: unable to create folder ${folder}`, err);
        process.exit(1);
    }

    try {
        console.log(`Setting up include folder and files...`);
        const prjFolder = `${process.cwd()}/include`;
        if (!fs.existsSync(prjFolder))
            fs.mkdirSync(prjFolder);
        const incFolder = path.join(__dirname, '..', 'include');
        await fsExtra.copy(incFolder, prjFolder, { overwrite: true });
    } catch (err) {
        console.log(`ERROR: unable to copy files to ${path.join(process.cwd(), 'include')}`, err);
        process.exit(1);
    }

    console.log(`Source files copied!`);

    try {
        await InstallTypescriptPlugin(process.cwd(), 'typescript');
        await InstallTypescriptPlugin(process.cwd(), 'typecon_plugin');
    } catch (err) {
        console.log(`ERROR: basic TS setup failed`, err);
        process.exit(1);
    }

    answer = await inquirer.prompt({
        type: 'list',
        name: 'choice',
        message: "Would you like to activate the TypeCON Plugin?",
        choices: ['Yes', 'No'],
        default: 'Yes'
    });

    if (answer.choice == 'Yes') {
        console.log(`Preparing the Typescript enviroment...`);
        try {
            if (!fs.existsSync(process.cwd() + `..vscode`))
                fs.mkdirSync(process.cwd() + `/.vscode`);

            fs.writeFileSync(process.cwd() + `/.vscode/settings.json`, JSON.stringify({ "typescript.tsdk": "node_modules/typescript/lib" }));
        } catch (err) {
            console.log(`ERROR: failed to prepare the Typescript enviroment`, err);
        }
    }

    try {
        console.log(`Setting up the Typescript configuration...`);
        fs.writeFileSync(`tsconfig.json`, JSON.stringify({
            compilerOptions: {
                plugins: [
                    {
                        name: `typecon_plugin`
                    }
                ],
                strict: true,
            },
            include: ["**/*.ts"],
            exclude: ["node_modules"]
        }));
    } catch (err) {
        console.log(`ERROR: failed to setup the TypeScript enviroment`, err);
        process.exit(1);
    }

    console.log(`TypeCON enviroment is ready!`);

    answer = await inquirer.prompt({
        type: 'list',
        name: 'choice',
        message: `What template would you like to use? Check Basic to see some examples or use 'None' if you're not setting up this right now`,
        choices: ['DN3D mod', 'Basic', 'None'],
        default: 'Basic'
    });

    switch (answer.choice) {
        case 'DN3D mod - (NOT WORKING YET)':
            break;

        case 'Basic':
            try {
                const templatesFolder = path.join(__dirname, '../templates');
                const prjTemplatesFolder = path.join(process.cwd(), folder);

                await fsExtra.copy(templatesFolder, prjTemplatesFolder, { overwrite: true });

                console.log('Basic templates are ready!\nCheck them out: AssaultTrooper.ts and test.ts\nCompile them using e.g: yarn tcc -i templates/AssaultTrooper.ts -o AssaultTrooper.con\nThe compiled file will be at "compiled"');
            } catch (err) {
                console.log(`ERROR: unable to copy files to ${path.join(process.cwd(), folder, 'include')}`, err);
            }
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
    16 - don't link pre-compiled modules
*/
let compile_options = 0;

console.log(`\n\x1b[36mTypeCON Compiler \x1b[31mALPHA\x1b[0m \x1b[92mVersion ${packConfig.version}\x1b[0m\x1b[94m
By ItsMarcos\x1b[0m - Use \x1b[95m'--help or -?'\x1b[0m to get the list of commands`);

async function Main() {
    if (!fs.existsSync(process.cwd() + '/compiled'))
    fs.mkdirSync(process.cwd() + '/compiled');

for (let i = 0; i < process.argv.length; i++) {
    const a = process.argv[i];

    if (a == '--input' || a == '-i') {
        fileName = process.argv[i + 1];

        if (input_folder != '') {
            console.log(`Input folder already defined`);
            process.exit(1);
        }

        if (!fs.existsSync(fileName)) {
            console.log(`File: ${fileName} not found!`);
            process.exit(1);
        }
    }

    if (a == '--input_folder' || a == '-if') {
        input_folder = process.argv[i + 1];

        if (fileName != '') {
            console.log(`Input file already defined`);
            process.exit(1);
        }

        if (!fs.existsSync(input_folder) || !fs.readdirSync(input_folder)) {
            console.log(`Path: ${input_folder} is not a folder or does not exist.`);
            process.exit(1);
        }

        GetAllFilesFromPath(input_folder);
    }

    if (a == '--line_print' || a == '-lp')
        line_print = true;

    if (a == '--symbol_print' || a == '-sp')
        symbol_print = true;

    if (a == '--stack_size' || a == '-ss')
        stack_size = Number(process.argv[i + 1]);

    if (a == '--page_size' || a == '-ps')
        heap_page_size = Number(process.argv[i + 1]);

    if (a == '--page_number' || a == '-pn')
        heap_page_number = Number(process.argv[i + 1]);

    if (a == '--output_folder' || a == '-of')
        output_folder = process.argv[i + 1];

    if (a == '--output' || a == '-o')
        output_file = process.argv[i + 1];

    if (a == '--headerless' || a == '-hl')
        compile_options |= 1;

    if (a == '--header' || a == '-h') {
        if (compile_options & 2) {
            console.log(`ERROR: you can't use -h with -nh parameters together`);
            process.exit(1);
        }
        compile_options |= 4 + 1;
    }

    if (a == '--no_precompiled' || a == '-np')
        precompiled_modules = false;

    if (a == '--one_file' || a == '-1f') {
        if (compile_options & 4) {
            console.log(`ERROR: you can't use -1f with -h parameter`)
            process.exit(1);
        }

        if (!output_file.length) {
            console.log(`ERROR: you must provide a name for the output file when using -1f`)
            process.exit(1);
        }

        compile_options |= 8;
    }

    if (a == '--link' || a == '-l') {
        link = true;
        for (let j = i + 1; j < process.argv.length; j++) {
            const arg = process.argv[j];
            if (arg.charAt(0) == '"' && arg.charAt(-1) == '"')
                linkList.push(arg);
            else break;
        }
    }

    if (a == '--input_list' || a == '-il') {
        link = true;
        for (let j = i + 1; j < process.argv.length; j++) {
            const arg = process.argv[j];
            if (arg.charAt(0) == '"' && arg.charAt(-1) == '"')
                files.push(arg);
            else break;
        }
    }

    if (a == '--default_inclusion' || a == '-di')
        default_inclusion = true;

    if (a == '--eduke_init' || a == '-ei')
        init_file = 'EDUKE.CON';

    if (a == 'setup') {
        initFunc = true;
        Setup();
    }

    if (a == '--help' || a == '-?') {
        console.log(helpText)
        process.exit(0);
    }
}

if (!initFunc) {
    if (stack_size < 1024)
        console.log(`WARNING: using a stack size lesser than 1024 is not recommended!`);

    const compiler = new TsToConCompiler({ lineDetail: line_print, symbolPrint: symbol_print });

    let code = '';

    const initSys = new CONInit(stack_size, heap_page_size, heap_page_number, precompiled_modules);

    if (fileName != '') {
        const file = fs.readFileSync(fileName);

        const result = compiler.compile(file.toString(), fileName);

        for (let i = compiledFiles.size - 1; i >= 0; i--) {
            const f = compiledFiles.get(Array.from(compiledFiles.keys())[i]);
            code += f.code;
        }

        fileName = GetOutputName(fileName);

        console.log(' ');

        if (compile_options & 4) {
            CreateInit([`${output_folder}/${fileName}.con`]);
            console.log(`${colorText('Writing:', 'cyan')} header file: ${output_folder}/header.con`);
            fs.writeFileSync(`${output_folder}/header.con`, initSys.BuildInitFile());

            console.log(`${colorText('Writing:', 'cyan')} ${output_folder}/${fileName}.con`);
            fs.writeFileSync(`${output_folder}/${fileName}.con`, code);
        } else {
            if (default_inclusion)
                code = `include GAME.CON\n\n` + initSys.BuildFullCodeFile(code);
            else {
                if (!(compile_options & 1))
                    code = initSys.BuildFullCodeFile(code);
            }

            console.log(`${colorText('Writing:', 'cyan')} ${output_folder}/${fileName}${fileName.endsWith('.con') ? '' : '.con'}`);
            fs.writeFileSync(`${output_folder}/${fileName}${fileName.endsWith('.con') ? '' : '.con'}`, code);
        }
    }

    if (files.length > 0) {
        let result: CompileResult;
        for (const f of files) {
            const file = fs.readFileSync(f);

            result = compiler.compile(file.toString(), f, result ? result.context : undefined);
        }

        if (compile_options & 8) {
            console.log(colorText(`Compiling into one file...`, 'magenta'));
            for (let i = compiledFiles.size - 1; i >= 0; i--) {
                const f = compiledFiles.get(Array.from(compiledFiles.keys())[i]);
                code += f.code;
            }

            if (!(compile_options & 1))
                code = initSys.BuildFullCodeFile(code);

            console.log(`${colorText('Writing:', 'cyan')} ${output_folder}/${output_file}${output_file.endsWith('.con') ? '' : '.con'}`);
            fs.writeFileSync(`${output_folder}/${output_file}${output_file.endsWith('.con') ? '' : '.con'}`, code);
        } else {
            compiledFiles.forEach(c => {
                if (c.options != 0)
                    return;
                const name = GetOutputName(c.path);
                console.log(`${colorText('Writing:', 'cyan')} ${output_folder}/${name}${name.endsWith('.con') ? '' : '.con'}`);
                fs.writeFileSync(`${output_folder}/${name}${name.endsWith('.con') ? '' : '.con'}`, c.code);

                if (compile_options & 4)
                    linkList.push(`${output_folder}/${name}${name.endsWith('.con') ? '' : '.con'}`);
            });

            if (compile_options & 4)
                link = true;
        }
    }

    if (link) {
        console.log(colorText(`Linking...`, 'blue'));
        CreateInit(linkList);
        console.log(`${colorText('Writing:', 'cyan')} header file: ${output_folder}/header.con`);
        fs.writeFileSync(`${output_folder}/header.con`, initSys.BuildInitFile());
    }

    if (fileName == '' && files.length == 0 && !link)
        console.log(`Nothing to do!\n${helpText}`);
    else
        console.log(colorText(`Compilation finished!`, 'green'));

    checkForUpdates();

    process.exit(0);
}
}

function CreateInit(outputFiles: string[]) {
    let code = '';

    console.log(`${colorText('Writing:', 'green')} init file: ${init_file}`);

    if (default_inclusion)
        code = `include GAME.CON\n\n`;

    code = `include header.con\n`;

    for (const o of outputFiles)
        code += `include ${o}.con\n`

    fs.writeFileSync(`${output_folder}/${init_file}`, code);
}

function GetOutputName(filename: string) {
    if (output_file.length > 0)
        return output_file;

    //Remove extension
    const ext = path.extname(filename);
    const final = path.basename(filename);

    if (ext != '')
        return final.slice(0, final.length - ext.length);

    return final;
}

Main();