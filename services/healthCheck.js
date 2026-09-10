import { runLocalCommand, sleep } from "./utils.js";
import { runSshCommand } from "./ssh.js";

export async function runHealthCheck(project) {
  const { healthCheck, type, cwd, ssh } = project;

  if (!healthCheck) {
    console.log("[HEALTH CHECK] No health check configured — skipping.");
    return { passed: true, skipped: true };
  }

  const {
    url,
    expectedStatus = 200,
    expectedText,
    command,
    intervalMs = 3000,
    maxRetries = 5,
    initialDelayMs = 2000,
  } = healthCheck;

  if (!url && !command) {
    console.log("[HEALTH CHECK] No url or command configured — skipping.");
    return { passed: true, skipped: true };
  }

  console.log(`[HEALTH CHECK] Starting (retries: ${maxRetries}, interval: ${intervalMs}ms)`);
  if (initialDelayMs > 0) {
    console.log(`[HEALTH CHECK] Initial delay: ${initialDelayMs}ms`);
    await sleep(initialDelayMs);
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let passed = false;
      let detail = "";

      if (url) {
        console.log(`[HEALTH CHECK] Attempt ${attempt}/${maxRetries} — GET ${url}`);
        const res = await fetch(url, { method: "GET" });
        const text = await res.text();
        const statusOk = res.status === expectedStatus;
        const textOk = expectedText ? text.includes(expectedText) : true;
        passed = statusOk && textOk;
        detail = `status=${res.status} (expected ${expectedStatus})` +
          (expectedText ? `, text-match=${textOk}` : "");
      } else if (command) {
        console.log(`[HEALTH CHECK] Attempt ${attempt}/${maxRetries} — CMD: ${command}`);
        if (type === "remote") {
          await runSshCommand(command, ssh, cwd);
        } else {
          await runLocalCommand(command, cwd);
        }
        passed = true;
        detail = "command exited with code 0";
      }

      if (passed) {
        console.log(`[HEALTH CHECK] PASSED on attempt ${attempt} — ${detail}`);
        return { passed: true, attempts: attempt };
      } else {
        console.log(`[HEALTH CHECK] FAILED on attempt ${attempt} — ${detail}`);
      }
    } catch (err) {
      console.log(`[HEALTH CHECK] ERROR on attempt ${attempt} — ${err.message}`);
    }

    if (attempt < maxRetries) {
      await sleep(intervalMs);
    }
  }

  console.log(`[HEALTH CHECK] FAILED after ${maxRetries} attempts`);
  return { passed: false, attempts: maxRetries };
}
