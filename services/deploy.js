import { exec } from "node:child_process";

const IS_PROD = process.env.NODE_ENV === "production";

function getShell() {
  return IS_PROD ? "/bin/bash" : "C:\\Program Files\\Git\\bin\\bash.exe";
}

function runCommand(command, cwd) {
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

async function runCommands(commands, cwd) {
  for (const command of commands) {
    await runCommand(command, cwd);
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

  await runCommand(commands.pull, cwd);

  if (dependenciesChanged(changedFiles)) {
    console.log("[INSTALL CHECK] package.json/lock changed — running install.");
    await runCommand(commands.install, cwd);
  } else {
    console.log("[INSTALL CHECK] No dependency changes — skipping install.");
  }

  await runCommand(`CI=false ${commands.build}`, cwd);

  if (commands.postBuild?.length > 0) {
    await runCommands(commands.postBuild, cwd);
  }
}