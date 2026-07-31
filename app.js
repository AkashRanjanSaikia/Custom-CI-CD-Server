import express from "express";
import { verifySignature } from "./middlewares/verifySignature.js";
import { deployProject } from "./services/deploy.js";
import { setCommitStatus } from "./services/status.js";
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

  const webhookBody = req.body || {};
  const repo = webhookBody?.repository?.full_name;
  const branch = webhookBody?.ref?.replace("refs/heads/", "");
  const deploymentId = webhookBody?.after;
  const commits = webhookBody?.commits || [];

  if (!deploymentId || /^0+$/.test(deploymentId)) return;

  const matchedProject = config.projects.find(
    (proj) => proj.repository === repo && proj.branch === branch,
  );

  if (!matchedProject) return;

  const targetUrl = `${process.env.SERVER_URL}/runs/${deploymentId}`;

  deploymentQueue.set(deploymentId, {
    project: matchedProject.name,
    deploymentId,
    status: "pending",
    startedAt: new Date().toISOString(),
  });

  // 1. Tell GitHub we're starting
  await setCommitStatus({
    repo,
    sha: deploymentId,
    state: "pending",
    description: "Deployment in progress",
    targetUrl,
  });

  try {
    await deployProject(matchedProject, commits);

    const record = deploymentQueue.get(deploymentId);
    record.status = "success";
    record.finishedAt = new Date().toISOString();

    // 2. Tell GitHub it succeeded
    await setCommitStatus({
      repo,
      sha: deploymentId,
      state: "success",
      description: "Deployment completed successfully",
      targetUrl,
    });
  } catch (err) {
    const record = deploymentQueue.get(deploymentId);
    record.status = "failure";
    record.error = err.message;
    record.finishedAt = new Date().toISOString();

    // 3. Tell GitHub it failed
    await setCommitStatus({
      repo,
      sha: deploymentId,
      state: "failure",
      description: "Deployment failed",
      targetUrl,
    });
  }
});

app.get("/runs/:deploymentId", (req, res) => {
  const { deploymentId } = req.params;
  const record = deploymentQueue.get(deploymentId);

  if (!record) {
    return res.status(404).json({
      success: false,
      message: "Run not found",
    });
  }

  res.status(200).json({
    success: true,
    ...record,
  });
});

app.listen(4000, () => {
  console.log("Server is running.");
});
