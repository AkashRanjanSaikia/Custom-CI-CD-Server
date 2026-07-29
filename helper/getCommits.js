export function getChangedFiles(commits) {
  const fileSet = new Set();

  for (const commit of commits) {
    (commit.added || []).forEach((f) => fileSet.add(f));
    (commit.modified || []).forEach((f) => fileSet.add(f));
    (commit.removed || []).forEach((f) => fileSet.add(f));
  }

  return Array.from(fileSet);
}