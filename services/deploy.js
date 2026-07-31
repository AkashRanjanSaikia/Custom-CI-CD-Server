import { exec } from "node:child_process";
import { runSshCommand, runSshCommands } from "./ssh.js";

const IS_PROD = process.env.NODE_ENV === "production";

function getShell() {
  return IS_PROD ? "/bin/bash" : "C:\\Program Files\\Git\\bin\\bash.exe";
}

function runLocalCommand(command, cwd) {
  console.log(`[RUN] ${command}  (cwd: ${cwd})`);

  return new Promise((resolve, reject) => {
    exec(
      command,
      { cwd, shell: getShell(), maxBuffer: 1024 * 1024 * 10 },
      (err, stdout, stderr) => {
        if (stdout) console.log("[stdout]", stdout);
        if (stderr) console.log("[stderr]", stderr);

        if (err) {
          console.log("[EXIT CODE]", err.code);
          return reject(new Error(stderr || err.message));
        }
        resolve(stdout);
      }
    );
  });
}

function runCommand(command, project, cwd) {
  if (project.type === "remote") {
    return runSshCommand(command, project.ssh, cwd);
  }
  return runLocalCommand(command, cwd);
}

async function runCommands(commands, project, cwd) {
  if (project.type === "remote") {
    return runSshCommands(commands, project.ssh, cwd);
  }
  for (const command of commands) {
    await runLocalCommand(command, cwd);
  }
}

/**
 * Flattens added/modified/removed files across all commits in a push.
 */
export function getChangedFiles(commits) {
  const fileSet = new Set();
  for (const commit of commits) {
    (commit.added || []).forEach((f) => fileSet.add(f));
    (commit.modified || []).forEach((f) => fileSet.add(f));
    (commit.removed || []).forEach((f) => fileSet.add(f));
  }
  return Array.from(fileSet);
}

/**
 * Checks if any dependency-related file changed in this push.
 */
function dependenciesChanged(changedFiles) {
  const dependencyFiles = ["package.json", "package-lock.json"];
  return changedFiles.some((file) => dependencyFiles.includes(file));
}

/**
 * Full deploy flow, driven by what GitHub says changed —
 * no local hashing/state needed.
 */
export async function deployProject(project, commits) {
  const { cwd, commands } = project;
  const changedFiles = getChangedFiles(commits);

  console.log("[CHANGED FILES]", changedFiles);
  console.log("[PROJECT TYPE]", project.type);

  await runCommand(commands.pull, project, cwd);

  if (dependenciesChanged(changedFiles)) {
    console.log("[INSTALL CHECK] package.json/lock changed — running install.");
    await runCommand(commands.install, project, cwd);
  } else {
    console.log("[INSTALL CHECK] No dependency changes — skipping install.");
  }

  if (commands.build) {
    await runCommand(`CI=false ${commands.build}`, project, cwd);
  }

  if (commands.postBuild?.length > 0) {
    await runCommands(commands.postBuild, project, cwd);
  }
}