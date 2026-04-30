import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const projectRoot = path.resolve(frontendRoot, "..");
export const docsRoot = path.join(projectRoot, "docs");
export const publicRoot = path.join(frontendRoot, "public", "documentation");
export const markdownPublicRoot = path.join(publicRoot, "markdown");
const generatedManifestPath = path.join(frontendRoot, "src", "documentationManifest.generated.json");
const rootMarkdown = [
  "README.md",
  "README.hu.md",
  "DESIGN.md",
  "TERMS_OF_USE.md",
  "CODE_OF_CONDUCT.md",
];

export function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function toPortablePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function readMarkdownTitle(content, fallbackTitle) {
  const titleLine = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /^#\s+/.test(line));
  return titleLine ? titleLine.replace(/^#\s+/u, "").trim() : fallbackTitle;
}

function readMarkdownSummary(content) {
  const lines = content.split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("---") ||
      trimmed.startsWith("```") ||
      trimmed.startsWith("|")
    ) {
      continue;
    }
    return trimmed.replace(/^[-*]\s+/u, "").slice(0, 220);
  }
  return "";
}

function publicMarkdownUrl(relativePath) {
  return `/documentation/markdown/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

function titleFromFolderName(folderName) {
  return folderName
    .replace(/[-_]+/gu, " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function groupDocsMarkdown(relativePath) {
  const pathParts = relativePath.split("/");
  if (pathParts.length > 2) {
    return titleFromFolderName(pathParts[1]);
  }

  const fileName = path.basename(relativePath).toLowerCase();
  const categoryRules = [
    {
      group: "Dataset Collection",
      patterns: [
        "collection",
        "dataset",
        "soloq",
        "flexset",
        "multi-dataset",
        "riot-api",
      ],
    },
    {
      group: "Graph Analytics",
      patterns: [
        "assortativity",
        "centrality",
        "brandes",
        "signed-balance",
        "balance",
        "associative-graph",
        "graph-v2",
        "graph-builder",
        "cluster",
        "birdseye",
      ],
    },
    {
      group: "Pathfinder Algorithms",
      patterns: [
        "pathfinder",
        "astar",
        "route",
        "experiment-runners",
      ],
    },
    {
      group: "Frontend UI",
      patterns: [
        "frontend",
        "gui",
        "ux",
        "design-system",
        "route-transition",
      ],
    },
    {
      group: "Thesis Framing",
      patterns: [
        "thesis",
        "methodological",
        "feasibility",
        "documentation",
        "document_map",
        "claude",
        "analysis-report",
      ],
    },
    {
      group: "Simulation",
      patterns: [
        "neurosim",
        "mock-datasets",
        "chaos",
      ],
    },
    {
      group: "Scoring",
      patterns: [
        "opscore",
        "player-details",
        "performance",
      ],
    },
    {
      group: "Operations",
      patterns: [
        "multi-key",
        "rate-limit",
      ],
    },
  ];

  return categoryRules.find((rule) =>
    rule.patterns.some((pattern) => fileName.includes(pattern)),
  )?.group ?? "Research Notes";
}

function copyMarkdownDocument(sourcePath, relativePath, group) {
  const destinationPath = path.join(markdownPublicRoot, ...relativePath.split("/"));
  ensureDirectory(path.dirname(destinationPath));
  fs.copyFileSync(sourcePath, destinationPath);

  const content = fs.readFileSync(sourcePath, "utf-8");
  const stats = fs.statSync(sourcePath);
  return {
    id: relativePath,
    path: relativePath,
    title: path.basename(relativePath),
    summary: readMarkdownSummary(content),
    group,
    size: stats.size,
    updatedAt: stats.mtime.toISOString(),
    contentUrl: publicMarkdownUrl(relativePath),
    content,
  };
}

function collectDocsMarkdown(currentDir, prefix = "docs") {
  if (!fs.existsSync(currentDir)) {
    return [];
  }

  const documents = [];
  const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const sourcePath = path.join(currentDir, entry.name);
    const relativePath = toPortablePath(path.join(prefix, entry.name));

    if (entry.isDirectory()) {
      documents.push(...collectDocsMarkdown(sourcePath, relativePath));
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) {
      continue;
    }

    documents.push(copyMarkdownDocument(sourcePath, relativePath, groupDocsMarkdown(relativePath)));
  }

  return documents;
}

export function syncDocumentation() {
  ensureDirectory(markdownPublicRoot);

  const projectDocuments = rootMarkdown
    .filter((fileName) => fs.existsSync(path.join(projectRoot, fileName)))
    .map((fileName) => copyMarkdownDocument(path.join(projectRoot, fileName), fileName, "Project"));

  const documents = [
    ...projectDocuments,
    ...collectDocsMarkdown(docsRoot),
  ].sort((left, right) => left.path.localeCompare(right.path));

  const thesisSource = path.join(docsRoot, "mainraw.pdf");
  let thesisPdf = null;
  if (fs.existsSync(thesisSource)) {
    const thesisDestination = path.join(publicRoot, "thesis.pdf");
    ensureDirectory(path.dirname(thesisDestination));
    fs.copyFileSync(thesisSource, thesisDestination);
    const stats = fs.statSync(thesisSource);
    thesisPdf = {
      title: "Compiled Thesis PDF",
      sourcePath: "docs/mainraw.pdf",
      url: "/documentation/thesis.pdf",
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
    };
  }

  const manifest = { documents, thesisPdf };
  fs.writeFileSync(
    path.join(publicRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  fs.writeFileSync(
    generatedManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = syncDocumentation();
  console.log(`Synced ${manifest.documents.length} markdown documents into frontend/public/documentation.`);
}
