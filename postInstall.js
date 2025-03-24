// scripts/postInstall.js
const path = require("path");
const fs = require("fs");
const fsExtra = require("fs-extra");

const packageRoot = process.cwd(); // The folder of your package
const projectRoot = process.env.INIT_CWD; // The root folder of the *user's* project

if (!projectRoot) {
  console.error("INIT_CWD not set. Unable to copy 'include' to the user's project.");
  process.exit(0);
}

// If these are the same, it often means the user is installing *within* your package repo,
// not installing your package in a *different* project.
if (packageRoot === projectRoot) {
  console.log("Detected installation in the package's own folder. Skipping postinstall...");
  process.exit(0); 
}

// We want to copy 'include/' from our package
const sourceFolder = path.join(packageRoot, "include");

// Destination in the user's project, e.g. 'src/include'
const destFolder = path.join(projectRoot, "src", "include");

console.log(`Copying TypeCON Language Sets to the projects's root folder...`);

(async () => {
  try {
    // Check if our source folder actually exists
    if (!fs.existsSync(sourceFolder)) {
      console.log(`No 'include' folder found at '${sourceFolder}'. Skipping copy.`);
      process.exit(0);
    }

    // Ensure the target directory exists (fs-extra handles this automatically)
    await fsExtra.copy(sourceFolder, destFolder, { overwrite: true });
    console.log(`Copy finished to: '${destFolder}'`);
  } catch (err) {
    console.error("Failed to copy the language sets folder:", err);
    process.exit(0);
  }
})();
