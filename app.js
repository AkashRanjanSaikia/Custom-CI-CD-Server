import express from "express";
import { verifySignature } from "./middlewares/verifySignature.js";
import { executeDeployCommands } from "./services/deploy.js";
import fs from "node:fs";

const app = express();

app.use(express.json());

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const deploymentQueue = new Map();

app.get("/", (req, res) => {
  res.send("Hii");
});

app.post("/webhook/github", verifySignature, async (req, res) => {
  res.status(200).json({ received: true });
  console.log("webhook received");
  const webhookBody = req.body || {};
  const repo = webhookBody?.repository?.full_name;
  const branch = webhookBody?.ref?.replace("refs/heads/", "");
  const deploymentId = webhookBody?.after;

  if (!deploymentId || /^0+$/.test(deploymentId)) {
    console.log("Branch deleted or invalid SHA — skipping.");
    return;
  }

  const matchedProject = config.projects.find(
    (proj) => proj.repository === repo && proj.branch === branch,
  );

  if (!matchedProject) {
    console.log(`No project configured for ${repo}@${branch} — skipping.`);
    return;
  }

  deploymentQueue.set(deploymentId, {
    project: matchedProject.name,
    deploymentId,
    status: "pending",
    startedAt: new Date().toISOString(),
  });

  try {
    await executeDeployCommands(
      matchedProject.deploy.commands,
      matchedProject.cwd,
    );
    const record = deploymentQueue.get(deploymentId);
    record.status = "success";
    record.finishedAt = new Date().toISOString();
  } catch (err) {
    const record = deploymentQueue.get(deploymentId);
    record.status = "failure";
    record.error = err.message;
    record.finishedAt = new Date().toISOString();
  }

  // Next: actually run the deploy — see Step 2 below
});

app.listen(4000, () => {
  console.log("Server is running.");
});
