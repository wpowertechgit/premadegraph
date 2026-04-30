export type DocumentationManifest = {
  documents: Array<{
    id: string;
    path: string;
    title: string;
    summary: string;
    group: string;
    size: number;
    updatedAt: string;
    contentUrl: string;
    content: string;
  }>;
  thesisPdf: {
    title: string;
    sourcePath: string;
    url: string;
    size: number;
    updatedAt: string;
  } | null;
};

export function syncDocumentation(): DocumentationManifest;
