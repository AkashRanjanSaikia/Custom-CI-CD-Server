import { exec } from "node:child_process";

const IS_PROD = process.env.NODE_ENV === "production";

function getShell() {
  return IS_PROD ? "/bin/bash" : "C:\\Program Files\\Git\\bin\\bash.exe";
}

function buildSshCommand(command, sshConfig, cwd) {
  const { host, username, privateKeyPath } = sshConfig;
  const remoteCommand = `cd ${cwd} && ${command}`;
  return `ssh -i "${privateKeyPath}" -o StrictHostKeyChecking=no ${username}@${host} "${remoteCommand}"`;
}

export function runSshCommand(command, sshConfig, cwd) {
  const sshCommand = buildSshCommand(command, sshConfig, cwd);
  console.log(`[SSH RUN] ${command}  (host: ${sshConfig.username}@${sshConfig.host}, cwd: ${cwd})`);

  return new Promise((resolve, reject) => {
    exec(
      sshCommand,
      { shell: getShell(), maxBuffer: 1024 * 1024 * 10 },
      (err, stdout, stderr) => {
        if (stdout) console.log("[SSH stdout]", stdout);
        if (stderr) console.log("[SSH stderr]", stderr);

        if (err) {
          console.log("[SSH EXIT CODE]", err.code);
          return reject(new Error(stderr || err.message));
        }
        resolve(stdout);
      }
    );
  });
}

export async function runSshCommands(commands, sshConfig, cwd) {
  for (const command of commands) {
    await runSshCommand(command, sshConfig, cwd);
  }
}
