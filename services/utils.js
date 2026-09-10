import { exec } from "node:child_process";
import { runSshCommand, runSshCommands } from "./ssh.js";

export const IS_PROD = process.env.NODE_ENV === "production";

export function getShell() {
  return IS_PROD ? "/bin/bash" : "C:\\Program Files\\Git\\bin\\bash.exe";
}

export function runLocalCommand(command, cwd, { logPrefix = "" } = {}) {
  const prefix = logPrefix || "[RUN]";
  console.log(`${prefix} ${command}  (cwd: ${cwd})`);

  return new Promise((resolve, reject) => {
    exec(
      command,
      { cwd, shell: getShell(), maxBuffer: 1024 * 1024 * 10 },
      (err, stdout, stderr) => {
        if (stdout) console.log(`${logPrefix || "[stdout]"}`, stdout);
        if (stderr) console.log(`${logPrefix || "[stderr]"}`, stderr);

        if (err) {
          console.log(`${logPrefix || "[EXIT CODE]"}`, err.code);
          return reject(new Error(stderr || err.message));
        }
        resolve(stdout);
      }
    );
  });
}

export function runCommand(command, project, cwd) {
  if (project.type === "remote") {
    return runSshCommand(command, project.ssh, cwd);
  }
  return runLocalCommand(command, cwd);
}

export async function runCommands(commands, project, cwd) {
  if (project.type === "remote") {
    return runSshCommands(commands, project.ssh, cwd);
  }
  for (const command of commands) {
    await runLocalCommand(command, cwd);
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
