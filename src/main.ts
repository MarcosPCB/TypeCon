#!/usr/bin/env node

import fs, { Dirent } from 'fs';
import path = require('path');
import { CONInit } from './modules/compiler/framework';
import { TsToConCompiler } from './modules/compiler/Compiler';
import { Linker } from './modules/linker/Linker';
import { validateCON } from './modules/con-validator/index';
import inquirer from 'inquirer';
const fsExtra = require("fs-extra");
import { spawnSync } from 'child_process';
const packConfig = require('../package.json');
import https from 'https';
import semver from 'semver';
import { loadConfig, runMake, MakeStep } from './modules/make/index';
import { runMakeCreate } from './modules/make/create';
import { runMakeConfig } from './modules/make/config';

let fileName = '';
let input_folder = '';
let line_print = false;
let symbol_print = false;
let stack_size = 1024;
let output_folder = 'compiled';
let objFolder = 'obj';
let objFolderExplicitlySet = false;
let output_file = '';
let linkList: string[] = [];
let files: string[] = [];
let separate = false;
let createInit = false;
let runLinker = false;
let default_inclusion = false;
let init_file = 'init.con';
let initFunc = false;
let precompiled_modules = true;
let heap_page_size = 4;
let heap_page_number = 128;
let eduke_init = false;
let share_context = false;
let compile_only = false;
let headerWritten = false;
let accept_con_modules = false;
let con_module = false;
let compile_mode: 'single' | 'module' = 'single';
let intermediate_code = false;
let clean = false;
let validateOnly = false;

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

    Make (project build system):
    \x1b[32mmake create\x1b[0m:   Interactive wizard — create typecon.json from scratch
    \x1b[32mmake config\x1b[0m:   Reconfigure typecon.json; toggle individual modules with arrow keys
    \x1b[32mmake\x1b[0m:          Run full pipeline: compile → link → validate
    \x1b[32mmake clear\x1b[0m:    Delete obj/, asm/, and compiled/ contents only (no build)
    \x1b[32mmake compile\x1b[0m:  Compile TypeScript sources to .tco only
    \x1b[32mmake link\x1b[0m:     Link .tco files into the output .con only
    \x1b[32mmake validate\x1b[0m: Validate the output .con only

    Common options (Works on both):
    \x1b[31m-i or --input\x1b[0m:  Input file path
    \x1b[32m-il or --input-list\x1b[0m: List of files to be processed (compilation or linking)
    \x1b[33m-o or --output\x1b[0m:  Output file name
    \x1b[34m-of or --output-folder\x1b[0m: Output folder path 
    \x1b[93m-aCm or --accept-con-modules\x1b[0m: Project accepts relocatable CON modules 

    Compile options:
    \x1b[31m-c or --compile\x1b[0m:  Compile input files to .tco (Intermediate) format for separate linking.
    \x1b[37m-if or --input-folder\x1b[0m: Compile all files within a folder
    \x1b[96m-m or --module\x1b[0m: (Compiler) Enable module mode for single file compilation
    \x1b[35m-sc or --share-context\x1b[0m: Share context between modules during compilation
    \x1b[36m-ic or --intermediate-code\x1b[0m: Generate intermediate code (CON with markers) in 'asm' folder
    \x1b[35m-dl or --detail-lines\x1b[0m: Write the original TS lines inside the CON code as comments


    Linker and Project options:
    \x1b[95m-L or --linker\x1b[0m: Link multiple .tco intermediate files into a single .con file
    \x1b[35m-sp or --symbol-print\x1b[0m: Print the symbol table for debugging
    \x1b[36m-ss or --stack-size\x1b[0m: Define the virtual stack size 
    \x1b[36m-hs or --heap-size\x1b[0m: Define the virtual heap's size
    \x1b[38m-ps or --page-size\x1b[0m: Define the heap page's minimum size 
    \x1b[39m-pn or --page-number\x1b[0m: Define the default number of heap pages
    \x1b[91m-hl or --headerless\x1b[0m: Don't insert the header code (init code and states) inside the output CON 
    \x1b[92m-h or --header\x1b[0m: Create the framework header file 
    \x1b[93m-ci or --create-init\x1b[0m: Create header and init files with list of CON files provided via -il
    \x1b[96m-sep or --separate\x1b[0m: (Used with -L) Output linked modules as separate CON files instead of one big file
    \x1b[94m-di or --default-inclusion\x1b[0m: Default inclusion (GAME.CON)  
    \x1b[95m-ei or --eduke-init\x1b[0m: Init file is EDUKE.CON
    \x1b[95m-Cm or --con-module\x1b[0m: (Linker) Output as a relocatable CON module (generates global array storage)
    \x1b[96m-np or --no-precompiled\x1b[0m: Disable automatic linking of pre-compiled system modules
    \x1b[91m-C or --clean\x1b[0m: Empty build folders (obj, asm, compiled) and exit

    Validator options:
    \x1b[32m-V or --validate\x1b[0m: Validate a compiled .con file against EDuke32 CON rules
        Reports block structure errors, unknown events, out-of-range tile IDs,
        invalid struct fields, and resource-limit violations.
        Use \x1b[33m-i\x1b[0m for a single file or \x1b[33m-il\x1b[0m for multiple files.
        Exit code 0 = OK (warnings only), 1 = errors found.`



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
        : fs.existsSync(path.join(projectRoot, 'package.json')) ? 'npm' : null;
}

async function InstallTypescriptPlugin(projectRoot: string, pluginName: string) {
    let manager = DetectPackageManager(projectRoot);
    if (!manager) {
        console.log(colorText(`No package manager found in ${projectRoot}`, 'yellow'));
        let answer = await inquirer.prompt({
            type: 'list',
            name: 'choice',
            message: 'Would you like to initialize a new yarn/npm project?',
            choices: ['yarn', 'npm', 'cancel'],
            default: 'yarn'
        });

        if (answer.choice === 'cancel') {
            console.log(colorText('Aborting...', 'magenta'));
            process.exit(1);
        }

        if (answer.choice === 'yarn') {
            console.log(colorText('Initializing yarn project...', 'magenta'));
            const result = await spawnSync('yarn', ['init', '-y'], { stdio: 'inherit', cwd: projectRoot, shell: true });

            if (result.status !== 0) {
                console.log(colorText('An error occurred during yarn initialization', 'red'));
                process.exit(1);
            }

            manager = 'yarn';
        } else if (answer.choice === 'npm') {
            console.log(colorText('Initializing npm project...', 'magenta'));
            const result = await spawnSync('npm', ['init', '-y'], { stdio: 'inherit', cwd: projectRoot, shell: true });
            if (result.status !== 0) {
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

    // ── make subcommand ──────────────────────────────────────────────────────
    if (process.argv[2] === 'make') {
        const sub = process.argv[3];
        if (sub === 'create') { await runMakeCreate(); process.exit(0); }
        if (sub === 'config') { await runMakeConfig(); process.exit(0); }
        const normalised = sub === 'clear' ? 'clean' : sub;
        const step = (['clean', 'compile', 'link', 'validate'].includes(normalised) ? normalised : 'all') as MakeStep;
        const cfg  = loadConfig(path.join(process.cwd(), 'typecon.json'));
        await runMake(step, cfg);
        process.exit(0);
    }

    for (let i = 0; i < process.argv.length; i++) {
        const a = process.argv[i];

        if (a == '--version') {
            console.log('Current version: ' + colorText('ALPHA', 'red') + ' ' + colorText(packConfig.version, 'green'));
            process.exit(0);
        }

        if (a == '--compile' || a == '-c')
            compile_only = true;

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

        if (a == '--input-folder' || a == '-if') {
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

        if (a == '--line-print' || a == '-lp' || a == '--detail-lines' || a == '-dl')
            line_print = true;

        if (a == '--symbol-print' || a == '-sp')
            symbol_print = true;

        if (a == '--stack-size' || a == '-ss')
            stack_size = Number(process.argv[i + 1]);

        if (a == '--page-size' || a == '-ps')
            heap_page_size = Number(process.argv[i + 1]);

        if (a == '--page-number' || a == '-pn')
            heap_page_number = Number(process.argv[i + 1]);

        if (a == '--output-folder' || a == '-of') {
            output_folder = process.argv[i + 1];
            objFolderExplicitlySet = true;
        }

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

        if (a == '--no-precompiled' || a == '-np')
            precompiled_modules = false;



        if (a == '--create-init' || a == '-ci' || a == '--link' || a == '-l') {
            createInit = true;
        }

        if (a == '--linker' || a == '-L') {
            runLinker = true;
        }

        if (a == '--input-list' || a == '-il') {
            let j = i + 1;
            for (; j < process.argv.length; j++) {
                const arg = process.argv[j];
                if (arg.startsWith('-')) break;

                if (!fs.existsSync(arg)) {
                    console.log(colorText(`Error: File ${arg} not found!`, 'red'));
                    process.exit(1);
                }

                files.push(arg);
                console.log(colorText(`Input file: ${arg}`, 'yellow'));
            }
            i = j - 1;
        }

        if (a == '--share-context' || a == '-sc')
            share_context = true;

        if (a == '--separate' || a == '-sep')
            separate = true;

        if (a == '--default-inclusion' || a == '-di')
            default_inclusion = true;

        if (a == '--eduke-init' || a == '-ei') {
            init_file = 'EDUKE.CON';
            eduke_init = true;
        }

        if (a == '--accept-con-modules' || a == '-aCm')
            accept_con_modules = true;

        if (a == '--con-module' || a == '-Cm')
            con_module = true;

        if (a == '--module' || a == '-m')
            compile_mode = 'module';

        if (a == '--intermediate-code' || a == '-ic') {
            compile_mode = 'module';
            intermediate_code = true;
            compile_only = true;
        }

        if (a == '--clean' || a == '-C')
            clean = true;

        if (a == '--validate' || a == '-V')
            validateOnly = true;

        if (a == 'setup') {
            initFunc = true;
        }

        if (a == '--help' || a == '-?') {
            console.log(helpText)
            process.exit(0);
        }
    }

    checkForUpdates();

    // STRICT MODE VALIDATION — exactly one of: setup, -c, -L, -C is required
    let modeCount = 0;
    if (initFunc) modeCount++;
    if (runLinker) modeCount++;
    if (compile_only) modeCount++;
    if (clean) modeCount++;
    if (validateOnly) modeCount++;

    if (modeCount === 0) {
        console.log(colorText('\nNo mode specified. You must choose exactly one of:', 'red'));
        console.log(colorText('  setup            : Run setup wizard', 'cyan'));
        console.log(colorText('  -c / --compile   : Compile source files to .tco', 'cyan'));
        console.log(colorText('  -L / --linker    : Link .tco files into a .con', 'cyan'));
        console.log(colorText('  -C / --clean     : Clean build folders', 'cyan'));
        console.log(colorText('  -V / --validate  : Validate a compiled .con file', 'cyan'));
        console.log(helpText);
        process.exit(1);
    }

    if (modeCount > 1) {
        console.log(colorText('\nError: Multiple conflicting modes specified — choose only one of: setup, -c, -L, -C', 'red'));
        process.exit(1);
    }

    if (initFunc) {
        await Setup();
    }

    if (validateOnly) {
        const validateFiles = files.length > 0 ? files : fileName ? [fileName] : [];
        if (validateFiles.length === 0) {
            console.log(colorText('Error: -V requires at least one .con input file via -i or -il', 'red'));
            process.exit(1);
        }
        const baseCONDir = path.join(process.cwd(), 'baseCON');
        let allOk = true;
        for (const file of validateFiles) {
            if (!fs.existsSync(file)) {
                console.log(colorText(`Error: File not found: ${file}`, 'red'));
                allOk = false;
                continue;
            }
            const text = fs.readFileSync(file, 'utf-8');
            const conDir = path.dirname(path.resolve(file));
            const baseDirs = [conDir];
            if (fs.existsSync(baseCONDir)) baseDirs.push(baseCONDir);
            const result = validateCON(text, { baseDirs });

            // Report each included file
            for (const inc of result.includedFiles) {
                const hasErrors = inc.diagnostics.some(d => d.severity === 'error');
                if (!hasErrors) {
                    const parts: string[] = [];
                    if (inc.gamevarsDelta > 0) parts.push(`gamevars: ${inc.gamevarsDelta}`);
                    if (inc.arraysDelta   > 0) parts.push(`arrays: ${inc.arraysDelta}`);
                    if (inc.statesDelta   > 0) parts.push(`states: ${inc.statesDelta}`);
                    if (inc.definesDelta  > 0) parts.push(`defines: ${inc.definesDelta}`);
                    if (inc.actionsDelta  > 0) parts.push(`actions: ${inc.actionsDelta}`);
                    if (inc.movesDelta    > 0) parts.push(`moves: ${inc.movesDelta}`);
                    if (inc.aisDelta      > 0) parts.push(`ais: ${inc.aisDelta}`);
                    if (inc.quotesDelta   > 0) parts.push(`quotes: ${inc.quotesDelta}`);
                    const stats = parts.length > 0 ? `  (${parts.join('  ')})` : '';
                    console.log(colorText(`OK  ${inc.filePath}`, 'green') + stats);
                }
            }

            if (result.diagnostics.length === 0) {
                console.log(colorText(`OK  ${file}`, 'green') + `  (${result.symbolTable.usageSummary()})`);
            } else {
                for (const d of result.diagnostics) {
                    const tag = d.severity === 'error'
                        ? colorText('[ERROR]', 'red')
                        : colorText('[WARN] ', 'yellow');
                    console.log(`${tag} ${d.file ?? file}:${d.line}  ${d.code} — ${d.message}`);
                }
                if (!result.ok) allOk = false;
            }
        }
        process.exit(allOk ? 0 : 1);
    }

    if (clean) {
        console.log(colorText('Cleaning build folders...', 'red'));
        const foldersToClean = ['obj', 'asm', 'compiled'];
        for (const folder of foldersToClean) {
            if (fs.existsSync(folder)) {
                console.log(`Cleaning ${folder}...`);
                fsExtra.emptyDirSync(folder);
            }
        }
        process.exit(0);
    }

    if (default_inclusion && separate && !createInit) {
        console.log(colorText("Error: --default-inclusion is only possible with the --create-init CLI when using --separate.", "red"));
        process.exit(1);
    }

    if (stack_size < 1024)
        console.log(`WARNING: using a stack size lesser than 1024 is not recommended!`);

    const compiler = new TsToConCompiler({ lineDetail: line_print, mode: compile_mode });
    const initSys = new CONInit(stack_size, heap_page_size, heap_page_number, precompiled_modules, heap_page_size * heap_page_number, 0, accept_con_modules);

    // --- LINK MODE ---
    if (runLinker) {
        // Collect input files from -i and -il
        const inputFiles: string[] = [];

        if (fileName === '' && files.length === 0 && input_folder === '') {
            console.log(colorText('No input specified, using default \'obj\' folder...', 'yellow'));
            input_folder = 'obj';
        }

        if (input_folder !== '') {
            GetAllFilesFromPath(input_folder);
            // In linker mode, we only want .tco files from the folder
            const tcoFiles = files.filter(f => f.endsWith('.tco') || f.endsWith('.icc'));
            // Clear the original files list as it might contain other types if we just pushed to it
            // Actually files is global and used by GetAllFilesFromPath. 
            // We should just filter what we add to inputFiles.
            // But wait, GetAllFilesFromPath pushes directly to `files`.
            // So `files` now contains everything from `input_folder`.
            // We should filter `files` in place or just use the filtered list.
            files.length = 0; // Clear global files list
            files.push(...tcoFiles);
        }

        if (fileName) inputFiles.push(fileName);
        if (files.length > 0) inputFiles.push(...files);
        if (inputFiles.length === 0) {
            console.log(colorText('Error: No input files provided for linker (and \'obj\' folder is empty or missing). Use -i, -il, or -if.', 'red'));
            process.exit(1);
        }

        const linker = new Linker(output_folder, initSys, con_module, (compile_options & 1) !== 0, symbol_print);
        for (const tco of inputFiles) {
            const cleanPath = tco.replace(/'/g, '');
            linker.loadModule(cleanPath);
        }

        if (separate) {
            const { header, modules } = linker.linkSeparate();

            let finalHeader = header;
            if (default_inclusion && !createInit) finalHeader = `include GAME.CON\n\n` + finalHeader;

            if (compile_options & 4) {
                console.log(`${colorText('Writing Header:', 'cyan')} ${output_folder}/header.con`);
                fs.writeFileSync(`${output_folder}/header.con`, finalHeader);
                headerWritten = true;
            }

            for (const mod of modules) {
                console.log(`${colorText('Writing Module:', 'cyan')} ${output_folder}/${mod.name}.con`);
                fs.writeFileSync(`${output_folder}/${mod.name}.con`, mod.code);
                linkList.push(`${mod.name}.con`);
            }
        } else {
            const { code: linkedCode, header: linkerHeader } = linker.link();
            let finalCode = linkedCode;

            if (default_inclusion && !((compile_options & 1))) {
                finalCode = `include GAME.CON\n\n` + finalCode;
                createInit = false;
                headerWritten = true;
            }
            // Default output name based on first input file
            let outName = output_file;
            if (!outName) {
                const firstFile = path.basename(inputFiles[0], '.tco');
                outName = firstFile + '.con';
            }
            console.log(`${colorText('Writing Linked CON:', 'cyan')} ${output_folder}/${outName}`);
            fs.writeFileSync(`${output_folder}/${outName}`, finalCode);
            linkList.push(`${outName}`);

            if (createInit || (compile_options & 4)) {
                if (createInit) {
                    console.log(colorText(`Creating Init Files...`, 'blue'));
                    CreateInit(linkList);
                }

                if (!headerWritten && (compile_options & 4)) {
                    console.log(`${colorText('Writing:', 'cyan')} header file: ${output_folder}/header.con`);
                    let hCode = linkerHeader; // Use header from liker which has global size
                    if (default_inclusion && !createInit) hCode = `include GAME.CON\n\n` + hCode;
                    fs.writeFileSync(`${output_folder}/header.con`, hCode);
                }
            }
        }

        process.exit(0);
    }


    // --- COMPILE ONLY MODE ---
    if (compile_only) {
        // Process fileName if set
        if (fileName != '') {
            files.push(fileName);
        }

        if (files.length === 0) {
            console.log(colorText('Error: No input files provided for compilation.', 'red'));
            process.exit(1);
        }

        if (intermediate_code && !objFolderExplicitlySet) {
            objFolder = 'asm';
        }

        if (objFolderExplicitlySet) {
            objFolder = output_folder;
        }

        if (!fs.existsSync(objFolder)) {
            fs.mkdirSync(objFolder, { recursive: true });
        }

        console.log(colorText(`Compiling modules to ${intermediate_code ? 'intermediate CON' : '.tco'}...`, 'cyan'));
        let sharedContext: any;
        for (const f of files) {
            const fContent = fs.readFileSync(f, 'utf8');
            const result = compiler.compileModule(fContent.toString(), f, sharedContext);
            if (result && result.module) {
                sharedContext = result.context;

                if (intermediate_code) {
                    const outPath = path.join(objFolder, path.basename(f, '.ts') + '.icc');
                    console.log(`Writing ${outPath}`);
                    fs.writeFileSync(outPath, result.module.code);
                } else {
                    const outPath = path.join(objFolder, path.basename(f, '.ts') + '.tco');
                    console.log(`Writing ${outPath}`);
                    fs.writeFileSync(outPath, JSON.stringify(result.module, (k, v) => k === 'parent' ? undefined : v, 2));
                }
            } else {
                console.log(colorText(`Failed to compile module ${f}`, 'red'));
            }
        }
        process.exit(0);
    }

}

function CreateInit(outputFiles: string[]) {
    let code = '';

    console.log(`${colorText('Writing:', 'green')} init file: ${init_file}`);

    if (default_inclusion)
        code += `include GAME.CON\n\n`;

    code += `include header.con\n`;

    for (const o of outputFiles) {
        code += `include ${o}\n`
    }

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