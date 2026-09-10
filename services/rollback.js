import { runCommand, runCommands } from "./utils.js";
import { getLastWorkingCommit } from "./deploymentState.js";
import { runHealthCheck } from "./healthCheck.js";

export async function getCurrentCommit(project) {
  try {
    const result = await runCommand("git rev-parse HEAD", project, project.cwd);
    return result.trim();
  } catch (err) {
    console.error("[ROLLBACK] Failed to get current commit:", err.message);
    return null;
  }
}

export async function rollbackToLastWorking(project) {
  const { cwd, commands, name } = project;
  const lastWorkingCommit = getLastWorkingCommit(name);

  if (!lastWorkingCommit) {
    console.error("[ROLLBACK] No last working commit found. Cannot rollback.");
    throw new Error("No previous working commit available for rollback");
  }

  console.log(`[ROLLBACK] Rolling back to commit: ${lastWorkingCommit.slice(0, 7)}`);

  await runCommand(`git checkout ${lastWorkingCommit}`, project, cwd);

  if (commands.install) {
    console.log("[ROLLBACK] Running install...");
    await runCommand(commands.install, project, cwd);
  }

  if (commands.build) {
    console.log("[ROLLBACK] Running build...");
    await runCommand(`CI=false ${commands.build}`, project, cwd);
  }

  if (commands.postBuild?.length > 0) {
    console.log("[ROLLBACK] Running postBuild commands...");
    await runCommands(commands.postBuild, project, cwd);
  }

  console.log("[ROLLBACK] Verifying rolled-back deployment...");
  const rollbackHealth = await runHealthCheck(project);
  if (!rollbackHealth.passed) {
    throw new Error("Rollback deployment also failed health check");
  }

  console.log("[ROLLBACK] Rollback completed successfully.");
  return { rolledBackTo: lastWorkingCommit };
}
