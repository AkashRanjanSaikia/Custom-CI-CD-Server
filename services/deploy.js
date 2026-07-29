import { exec } from "node:child_process";

export function executeDeployCommands(commands, cwd) {
  console.log("Running commands:", commands, "in cwd:", cwd);
  return new Promise((resolve, reject) => {
    const commandStr = commands.join(" && ");

    exec(commandStr, { cwd, shell: "C:\\Program Files\\Git\\bin\\bash.exe" }, (err, stdout, stderr) => {
      console.log("[stdout]", stdout);
      if (stderr) console.log("[stderr]", stderr);
      if (err) {
        console.log("[EXIT CODE]", err.code);   // <-- add this
        console.log("[ERROR MESSAGE]", err.message);
        return reject(new Error(stderr || err.message));
      }
      resolve(stdout);
    });
  });
}