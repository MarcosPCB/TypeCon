// scripts/postBuild.js
console.log("Build completed successfully!");
// e.g. copy extra assets, rename files, etc.

console.log(`Copying language sets to include folder`);
const fsExtra = require("fs-extra");
const path = require("path");

const srcDir = path.join(__dirname, "./src/sets");
const destDir = path.join(__dirname, "./include");

fsExtra.copySync(srcDir, destDir);
console.log("Copied language sets to include folder");
