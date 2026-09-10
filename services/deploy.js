import { runCommand, runCommands } from "./utils.js";
import { getLastWorkingCommit, setLastWorkingCommit } from "./deploymentState.js";
import { runHealthCheck } from "./healthCheck.js";
import { getCurrentCommit, rollbackToLastWorking } from "./rollback.js";

export function getChangedFiles(commits) {
  const fileSet = new Set();
  for (const commit of commits) {
    (commit.added || []).forEach((f) => fileSet.add(f));
    (commit.modified || []).forEach((f) => fileSet.add(f));
    (commit.removed || []).forEach((f) => fileSet.add(f));
  }
  return Array.from(fileSet);
}

function dependenciesChanged(changedFiles) {
  const dependencyFiles = ["package.json", "package-lock.json"];
  return changedFiles.some((file) => dependencyFiles.includes(file));
}

export async function deployProject(project, commits) {
  const { cwd, commands, name } = project;
  const changedFiles = getChangedFiles(commits);

  console.log("[CHANGED FILES]", changedFiles);
  console.log("[PROJECT TYPE]", project.type);

  const previousWorkingCommit = getLastWorkingCommit(name);
  console.log(`[PREVIOUS WORKING COMMIT] ${previousWorkingCommit ? previousWorkingCommit.slice(0, 7) : "none"}`);

  await runCommand(commands.pull, project, cwd);

  const currentCommitAfterPull = await getCurrentCommit(project);
  console.log(`[CURRENT COMMIT] ${currentCommitAfterPull ? currentCommitAfterPull.slice(0, 7) : "unknown"}`);

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

  const healthCheckConfigured = !!project.healthCheck;
  const healthResult = await runHealthCheck(project);

  if (!healthResult.passed) {
  console.warn(`[HEALTH CHECK] Deployment for ${name} failed. Initiating rollback...`);

  let rollbackResult;
  try {
    rollbackResult = await rollbackToLastWorking(project);
  } catch (rollbackErr) {
    console.error(`[ROLLBACK FAILED] ${rollbackErr.message}`);
    throw new Error(
      `Health check failed after ${healthResult.attempts} attempts. Rollback also failed: ${rollbackErr.message}`
    );
  }

  console.log(`[ROLLBACK SUCCESS] ${name} rolled back to ${rollbackResult.rolledBackTo.slice(0, 7)}`);
  throw new Error(
    `Health check failed after ${healthResult.attempts} attempts. Rolled back to last working commit ${rollbackResult.rolledBackTo.slice(0, 7)}.`
  );
}

  const shouldSaveLastWorking = currentCommitAfterPull &&
    (!healthCheckConfigured || healthResult.skipped !== true);

  if (shouldSaveLastWorking) {
    setLastWorkingCommit(name, currentCommitAfterPull);
    console.log(`[STATE] Saved ${currentCommitAfterPull.slice(0, 7)} as last working commit for ${name}`);
  } else if (currentCommitAfterPull && healthCheckConfigured && healthResult.skipped) {
    console.warn(
      `[STATE] healthCheck is configured but no url/command was set — ` +
      `not saving ${currentCommitAfterPull.slice(0, 7)} as last working commit for ${name} ` +
      `to avoid trusting an unverified deployment.`
    );
  }
}
