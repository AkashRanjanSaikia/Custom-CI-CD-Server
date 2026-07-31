export async function setCommitStatus({ repo, sha, state, description, targetUrl }) {
  const res = await fetch(`https://api.github.com/repos/${repo}/statuses/${sha}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state,           // "pending" | "success" | "failure" | "error"
      description,
      target_url: targetUrl,
      context: "ci/cd-pipeline",
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`[GITHUB STATUS] Failed to set status: ${res.status} — ${errorBody}`);
  } else {
    console.log(`[GITHUB STATUS] Set "${state}" for ${sha.slice(0, 7)} on ${repo}`);
  }
}