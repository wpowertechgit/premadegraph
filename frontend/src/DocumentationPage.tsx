import React, { useEffect, useMemo, useState } from "react";
import { FaBookOpen, FaExternalLinkAlt, FaFilePdf, FaSearch, FaSyncAlt, FaTimes } from "react-icons/fa";
import { buttonStyle, inputStyle, pageShellStyle, sectionLabelStyle } from "./theme";
import generatedManifest from "./documentationManifest.generated.json";

type DocumentationEntry = {
  id: string;
  path: string;
  title: string;
  summary: string;
  group: string;
  size: number;
  updatedAt: string;
  contentUrl?: string;
  content?: string;
};

type ThesisPdfEntry = {
  title: string;
  sourcePath: string;
  url: string;
  size: number;
  updatedAt: string;
};

type DocumentationManifest = {
  documents: DocumentationEntry[];
  thesisPdf: ThesisPdfEntry | null;
};

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; language: string; text: string }
  | { type: "blockquote"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

const DOCUMENTATION_API = "http://localhost:3001/api/documentation";
const STATIC_DOCUMENTATION_MANIFEST_URL = "/documentation/manifest.json";
const DOCUMENTATION_SYNC_URL = "/__documentation-sync";
const DOCUMENTATION_COMPILE_THESIS_URL = "/__documentation-compile-thesis";

function formatBytes(value: number) {
  if (!Number.isFinite(value)) {
    return "0 KB";
  }
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fileNameFromPath(documentPath: string) {
  return documentPath.split("/").at(-1) ?? documentPath;
}

function isMarkdownBoundary(line: string) {
  const trimmed = line.trim();
  return (
    !trimmed ||
    /^#{1,6}\s/.test(trimmed) ||
    /^```/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^[-*]\s+/.test(trimmed) ||
    /^\d+\.\s+/.test(trimmed) ||
    looksLikeTableStart(trimmed)
  );
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());
}

function looksLikeTableStart(line: string) {
  return line.includes("|") && !line.startsWith("http");
}

function looksLikeTableSeparator(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/u.test(line.trim());
}

function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/gu, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const codeMatch = trimmed.match(/^```(\w+)?/u);
    if (codeMatch) {
      const language = codeMatch[1] || "";
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", language, text: codeLines.join("\n") });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/u);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2].trim() });
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/u, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join(" ") });
      continue;
    }

    if (looksLikeTableStart(trimmed) && index + 1 < lines.length && looksLikeTableSeparator(lines[index + 1])) {
      const headers = splitTableRow(trimmed);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && looksLikeTableStart(lines[index].trim())) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/u);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/u);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        const match = orderedList ? current.match(/^\d+\.\s+(.+)$/u) : current.match(/^[-*]\s+(.+)$/u);
        if (!match) {
          break;
        }
        items.push(match[1]);
        index += 1;
      }
      blocks.push({ type: "list", ordered: orderedList, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && !isMarkdownBoundary(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    if (paragraphLines.length) {
      blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    } else {
      blocks.push({ type: "paragraph", text: trimmed });
      index += 1;
    }
  }

  return blocks;
}

function renderInline(text: string) {
  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`]+`)|\[([^\]]+)\]\(([^)]+)\)/gu;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      nodes.push(<code key={`${match.index}-code`}>{match[1].slice(1, -1)}</code>);
    } else {
      nodes.push(
        <a key={`${match.index}-link`} href={match[3]} target={match[3].startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          {match[2]}
        </a>,
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function MarkdownRenderer({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="documentation-markdown">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = `h${Math.min(block.level + 1, 6)}` as keyof JSX.IntrinsicElements;
          return <Tag key={index}>{renderInline(block.text)}</Tag>;
        }
        if (block.type === "paragraph") {
          return <p key={index}>{renderInline(block.text)}</p>;
        }
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </Tag>
          );
        }
        if (block.type === "code") {
          return (
            <pre key={index}>
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.type === "blockquote") {
          return <blockquote key={index}>{renderInline(block.text)}</blockquote>;
        }
        return (
          <div key={index} className="documentation-table-wrap">
            <table>
              <thead>
                <tr>
                  {block.headers.map((header, headerIndex) => (
                    <th key={headerIndex}>{renderInline(header)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{renderInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function emptyManifest(): DocumentationManifest {
  return { documents: [], thesisPdf: null };
}

function normalizeManifest(value: unknown): DocumentationManifest {
  const candidate = value as Partial<DocumentationManifest>;
  return {
    documents: Array.isArray(candidate.documents) ? candidate.documents : [],
    thesisPdf: candidate.thesisPdf ?? null,
  };
}

const BUNDLED_MANIFEST = normalizeManifest(generatedManifest);

export default function DocumentationPage() {
  const [manifest, setManifest] = useState<DocumentationManifest>(BUNDLED_MANIFEST);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [markdown, setMarkdown] = useState("");
  const [filter, setFilter] = useState("");
  const [loadingManifest, setLoadingManifest] = useState(true);
  const [loadingMarkdown, setLoadingMarkdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfPage, setPdfPage] = useState("1");
  const [pdfZoom, setPdfZoom] = useState("page-width");
  const [pdfCacheKey, setPdfCacheKey] = useState(() => Date.now());
  const [compilingThesis, setCompilingThesis] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingManifest(true);
    const bundledPreferred = BUNDLED_MANIFEST.documents.find((document) => document.path === "docs/DOCUMENT_MAP.md") ?? BUNDLED_MANIFEST.documents[0];
    setSelectedPath((current) => current || bundledPreferred?.path || "");

    const loadManifest = () => fetch(STATIC_DOCUMENTATION_MANIFEST_URL, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Static documentation manifest is unavailable.");
        }
        return response.json() as Promise<DocumentationManifest>;
      });

    fetch(DOCUMENTATION_SYNC_URL, { method: "POST", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Documentation sync endpoint is unavailable.");
        }
        return response.json() as Promise<DocumentationManifest & { ok?: boolean }>;
      })
      .catch(() => loadManifest())
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setManifest(payload);
        const preferred = payload.documents.find((document) => document.path === "docs/DOCUMENT_MAP.md") ?? payload.documents[0];
        setSelectedPath(preferred?.path ?? "");
        setError(null);
      })
      .catch(() => fetch(`${DOCUMENTATION_API}/manifest`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Documentation manifest is unavailable.");
          }
          return response.json() as Promise<DocumentationManifest>;
        })
        .then((payload) => {
          if (cancelled) {
            return;
          }
          setManifest(payload);
          const preferred = payload.documents.find((document) => document.path === "docs/DOCUMENT_MAP.md") ?? payload.documents[0];
          setSelectedPath(preferred?.path ?? "");
          setError(null);
        }))
      .catch((loadError) => {
        if (!cancelled) {
          setManifest(BUNDLED_MANIFEST);
          setSelectedPath((current) => current || bundledPreferred?.path || "");
          setError(loadError instanceof Error ? loadError.message : "Documentation manifest is unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingManifest(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedPath) {
      setMarkdown("");
      return;
    }

    const selectedManifestDocument = manifest.documents.find((document) => document.path === selectedPath);
    if (selectedManifestDocument?.content) {
      setMarkdown(selectedManifestDocument.content);
      setLoadingMarkdown(false);
      return;
    }

    let cancelled = false;
    setLoadingMarkdown(true);
    const staticUrl = selectedManifestDocument?.contentUrl;
    const markdownUrl = staticUrl || `${DOCUMENTATION_API}/markdown?path=${encodeURIComponent(selectedPath)}`;
    fetch(markdownUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Markdown document is unavailable.");
        }
        return response.text();
      })
      .then((content) => {
        if (!cancelled) {
          setMarkdown(content);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setMarkdown("");
          setError(loadError instanceof Error ? loadError.message : "Markdown document is unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMarkdown(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [manifest.documents, selectedPath]);

  const refreshThesisPdf = async () => {
    setCompilingThesis(true);
    setError(null);
    try {
      const response = await fetch(DOCUMENTATION_COMPILE_THESIS_URL, {
        method: "POST",
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.stderr || payload.error || "Thesis compile failed.");
      }
      setManifest({
        documents: Array.isArray(payload.documents) ? payload.documents : manifest.documents,
        thesisPdf: payload.thesisPdf ?? manifest.thesisPdf,
      });
      setPdfCacheKey(Date.now());
      setPdfOpen(true);
    } catch (compileError) {
      setError(compileError instanceof Error ? compileError.message : "Thesis compile failed.");
    } finally {
      setCompilingThesis(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) {
      return manifest.documents;
    }
    return manifest.documents.filter((document) =>
      `${document.title} ${document.path} ${document.summary} ${document.group}`.toLowerCase().includes(needle),
    );
  }, [filter, manifest.documents]);

  const groupedDocuments = useMemo(() => {
    const groups = new Map<string, DocumentationEntry[]>();
    for (const document of filteredDocuments) {
      const group = groups.get(document.group) ?? [];
      group.push(document);
      groups.set(document.group, group);
    }
    return Array.from(groups.entries());
  }, [filteredDocuments]);

  const selectedDocument = manifest.documents.find((document) => document.path === selectedPath) ?? null;
  const selectedFileName = selectedDocument ? fileNameFromPath(selectedDocument.path) : "No document selected";
  const pdfPageNumber = Math.max(1, Number.parseInt(pdfPage, 10) || 1);
  const pdfBaseUrl = manifest.thesisPdf ? `${manifest.thesisPdf.url}?v=${pdfCacheKey}` : "";
  const pdfSrc = manifest.thesisPdf
    ? `${pdfBaseUrl}#page=${pdfPageNumber}&zoom=${encodeURIComponent(pdfZoom)}`
    : "";

  return (
    <div className="documentation-page" style={pageShellStyle()}>
      <header className="documentation-toolbar">
        <div className="documentation-toolbar__title">
          <div style={sectionLabelStyle()} className="documentation-hero__label">
            <FaBookOpen />
            <span>Documentation</span>
          </div>
          <h1>Docs</h1>
        </div>

        <label className="documentation-search documentation-toolbar__search">
          <FaSearch />
          <input
            style={inputStyle()}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter markdown"
          />
        </label>

        <button
          type="button"
          className="documentation-pdf-button"
          style={buttonStyle("ghost")}
          onClick={() => void refreshThesisPdf()}
          disabled={compilingThesis}
        >
          {compilingThesis ? <span className="spinner" /> : <FaSyncAlt />}
          <span>{compilingThesis ? "Compiling..." : "Refresh PDF"}</span>
        </button>

        <button
          type="button"
          className="documentation-pdf-button"
          style={buttonStyle("ghost")}
          onClick={() => setPdfOpen(true)}
          disabled={!manifest.thesisPdf}
        >
          <FaFilePdf />
          <span>Thesis PDF</span>
        </button>
      </header>

      <nav className="documentation-category-drawer" aria-label="Documentation categories">
        {loadingManifest ? <div className="documentation-muted">Loading documentation...</div> : null}
        {!loadingManifest && filteredDocuments.length === 0 ? (
          <div className="documentation-muted">No documents match this filter.</div>
        ) : null}
        {groupedDocuments.map(([group, documents]) => (
          <div key={group} className="documentation-category">
            <button type="button" className="documentation-category__trigger">
              <span>{group}</span>
              <strong>{documents.length}</strong>
            </button>
            <div className="documentation-category__menu">
              {documents.map((document) => (
                <button
                  key={document.path}
                  type="button"
                  className={`documentation-category__item${document.path === selectedPath ? " is-active" : ""}`}
                  onClick={() => setSelectedPath(document.path)}
                  title={document.path}
                >
                  {fileNameFromPath(document.path)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {error ? <div className="documentation-alert">{error}</div> : null}

      <section className="documentation-workspace">
        <article className="documentation-reader">
          <div className="documentation-reader__bar">
            <div>
              <div style={sectionLabelStyle()}>{selectedDocument?.group ?? "Document"}</div>
              <h2>{selectedFileName}</h2>
              {selectedDocument ? (
                <div className="documentation-reader__meta">
                  <span>{selectedDocument.path}</span>
                  <span>{formatBytes(selectedDocument.size)}</span>
                  <span>{formatDate(selectedDocument.updatedAt)}</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="documentation-reader__body">
            {loadingMarkdown ? (
              <div className="documentation-muted">Loading markdown...</div>
            ) : markdown ? (
              <MarkdownRenderer content={markdown} />
            ) : (
              <div className="documentation-muted">Select a markdown file from the index.</div>
            )}
          </div>
        </article>
      </section>

      {pdfOpen && manifest.thesisPdf ? (
        <div className="documentation-pdf-overlay" role="dialog" aria-modal="true" aria-label="Thesis PDF reader">
          <div className="documentation-pdf-overlay__panel">
            <div className="documentation-pdf-overlay__bar">
              <div className="documentation-pdf-overlay__title">
                <FaFilePdf />
                <span>Thesis PDF</span>
              </div>
              <label>
                <span>Page</span>
                <input
                  type="number"
                  min="1"
                  value={pdfPage}
                  onChange={(event) => setPdfPage(event.target.value)}
                />
              </label>
              <label>
                <span>Zoom</span>
                <select value={pdfZoom} onChange={(event) => setPdfZoom(event.target.value)}>
                  <option value="page-width">Page width</option>
                  <option value="75">75%</option>
                  <option value="100">100%</option>
                  <option value="125">125%</option>
                  <option value="150">150%</option>
                  <option value="200">200%</option>
                </select>
              </label>
              <a
                href={pdfSrc}
                target="_blank"
                rel="noreferrer"
                className="documentation-pdf-overlay__external"
                title="Open PDF in a new tab"
              >
                <FaExternalLinkAlt />
              </a>
              <button
                type="button"
                className="documentation-pdf-overlay__close"
                onClick={() => setPdfOpen(false)}
                aria-label="Close PDF"
              >
                <FaTimes />
              </button>
            </div>
            <iframe title="Thesis PDF reader" src={pdfSrc} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
