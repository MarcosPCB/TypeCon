#!/usr/bin/env node
const { execSync } = require('child_process');

// scripts/postBuild.js
console.log("Build completed successfully!");

// compile the extra modules
console.log(`Compiling extra modules...`);
execSync(`yarn start -if ./src/sets/TCSet100/precompile/src -of ./src/sets/TCSet100/precompile/generated -hl -np`,
    { stdio: 'inherit'}
);
console.log(`Compiled modules`);

// e.g. copy extra assets, rename files, etc.

console.log(`Copying language sets to include folder`);
const fsExtra = require("fs-extra");
const path = require("path");

const srcDir = path.join(__dirname, "./src/sets");
const destDir = path.join(__dirname, "./include");

fsExtra.copySync(srcDir, destDir);
console.log("Done");
