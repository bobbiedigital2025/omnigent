import fs from 'fs/promises';
import path from 'path';

export interface HuggingFaceModelInfo {
  id: string;
  author: string;
  tags: string[];
  pipeline_tag: string | null;
  downloads: number;
  cardData?: Record<string, any>;
}

export interface AgentDownloadResult {
  modelId: string;
  localPath: string;
  files: string[];
  manifest: Record<string, any>;
}

const HF_BASE = 'https://huggingface.co';
const HF_API_MODELS = `${HF_BASE}/api/models`;

const sanitizeFilename = (input: string) => input.replace(/[<>:"/\\|?*]+/g, '_');

const fetchWithToken = async (url: string, token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { headers });
};

export const listHuggingFaceModels = async (query = 'agent'): Promise<HuggingFaceModelInfo[]> => {
  const url = new URL(HF_API_MODELS);
  url.searchParams.append('search', query);
  url.searchParams.append('full', 'true');
  const response = await fetchWithToken(url.toString(), process.env.HF_API_TOKEN);
  if (!response.ok) {
    throw new Error(`Hugging Face API list failed with ${response.status}`);
  }
  const body = await response.json();
  return body.slice(0, 10).map((entry: any) => ({
    id: entry.modelId || entry.id,
    author: entry.author?.name || entry.author || 'unknown',
    tags: entry.tags || [],
    pipeline_tag: entry.pipeline_tag || null,
    downloads: typeof entry.downloads === 'number' ? entry.downloads : 0,
    cardData: entry.cardData || {}
  }));
};

export const downloadHuggingFaceAgent = async (
  modelId: string,
  downloadRoot = process.env.AGENT_DOWNLOAD_ROOT || path.join(process.cwd(), 'downloaded-agents'),
  token?: string
): Promise<AgentDownloadResult> => {
  const manifestUrl = `${HF_API_MODELS}/${encodeURIComponent(modelId)}`;
  const response = await fetchWithToken(manifestUrl, token || process.env.HF_API_TOKEN);
  if (!response.ok) {
    throw new Error(`Failed to fetch model metadata for ${modelId}: ${response.status}`);
  }
  const metadata = await response.json();
  const agentFolder = path.join(downloadRoot, sanitizeFilename(modelId));
  await fs.mkdir(agentFolder, { recursive: true });

  const manifest = {
    modelId,
    downloadedAt: new Date().toISOString(),
    metadata: {
      id: metadata.modelId || metadata.id || modelId,
      author: metadata.author?.name || metadata.author || 'unknown',
      tags: metadata.tags || [],
      pipeline_tag: metadata.pipeline_tag || null,
      downloads: metadata.downloads || 0,
      description: metadata.cardData?.title || metadata.modelId || modelId,
      license: metadata.cardData?.license || metadata.license || null
    },
    source: 'huggingface',
    sourceUrl: `${HF_BASE}/${modelId}`
  };

  const files: string[] = [];
  const manifestPath = path.join(agentFolder, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  files.push('manifest.json');

  const possibleAssets = ['README.md', 'config.json'];
  for (const asset of possibleAssets) {
    const rawUrl = `${HF_BASE}/${modelId}/raw/main/${asset}`;
    const assetRes = await fetchWithToken(rawUrl, token || process.env.HF_API_TOKEN);
    if (assetRes.ok) {
      const destPath = path.join(agentFolder, asset);
      const content = await assetRes.text();
      await fs.writeFile(destPath, content, 'utf8');
      files.push(asset);
    }
  }

  return {
    modelId,
    localPath: agentFolder,
    files,
    manifest
  };
};
