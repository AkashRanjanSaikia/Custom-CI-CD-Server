import fs from "node:fs";
import path from "node:path";

const STATE_FILE = path.join(process.cwd(), "deployment-state.json");

function loadDeploymentState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
  } catch (err) {
    console.error("[STATE] Failed to load deployment state:", err.message);
  }
  return {};
}

function saveDeploymentState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error("[STATE] Failed to save deployment state:", err.message);
  }
}

export function getLastWorkingCommit(projectName) {
  const state = loadDeploymentState();
  return state[projectName]?.lastWorkingCommit || null;
}

export function setLastWorkingCommit(projectName, commitSha) {
  const state = loadDeploymentState();
  state[projectName] = state[projectName] || {};
  state[projectName].lastWorkingCommit = commitSha;
  state[projectName].lastUpdated = new Date().toISOString();
  saveDeploymentState(state);
}
