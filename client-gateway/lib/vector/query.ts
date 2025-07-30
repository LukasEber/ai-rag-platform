import { embedBatch, embedText } from '@/lib/ai/embed';
import { randomUUID } from 'crypto';
import { qdrant } from './qdrant';
import { estimateTokenCount } from '../ai/utils';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { createContextFile } from '../db/queries';
import pdfParse from 'pdf-parse'; 

const VECTOR_SIZE = 1536; // OpenAI embedding size
const DISTANCE = 'Cosine';
const MAX_TOKENS_PER_BATCH = 270_000;
const MAX_POINTS_PER_BATCH = 1200;

function getCollectionName(projectId: string) {
  return `project_${projectId}`;
}

async function extractTextFromFile(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (file.type === 'application/pdf') {
    const { text } = await pdfParse(buf);
    return text;
  }
  return buf.toString('utf-8');
}

async function splitTextIntoChunks(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
    chunkOverlap: 300,
    separators: ['\n\n', '\n'],
  });

  const documents = await splitter.createDocuments([text]);
  return documents.map(d => d.pageContent);
}

async function ensureQdrantCollection(projectId: string) {
  const collectionName = getCollectionName(projectId);
  const { collections } = await qdrant.getCollections();
  const exists = collections.some((c) => c.name === collectionName);
  if (!exists) {
    await qdrant.createCollection(collectionName, {
      vectors: { size: VECTOR_SIZE, distance: DISTANCE },
    });
  }
  return collectionName;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  console.log('generating embeddings for', texts.length, 'texts');

  const result: number[][] = [];
  let currentBatch: string[] = [];
  let currentTokenSum = 0;
  for (const text of texts) {
    const tokenCount = estimateTokenCount(text);

    if (currentTokenSum + tokenCount > MAX_TOKENS_PER_BATCH) {
      const embeddings = await embedBatch(currentBatch);
      result.push(...embeddings);
      currentBatch = [];
      currentTokenSum = 0;
    }

    currentBatch.push(text);
    currentTokenSum += tokenCount;
  }

  if (currentBatch.length > 0) {
    const embeddings = await embedBatch(currentBatch);
    result.push(...embeddings);
  }

  return result;
}

export async function upsertChunks(
  projectId: string,
  chunks: string[],
  embeddings: number[][]
): Promise<number> {
  const collectionName = await ensureQdrantCollection(projectId);

  let total = 0;

  for (let i = 0; i < chunks.length; i += MAX_POINTS_PER_BATCH) {
    const chunkBatch = chunks.slice(i, i + MAX_POINTS_PER_BATCH);
    const embeddingBatch = embeddings.slice(i, i + MAX_POINTS_PER_BATCH);

    const points = chunkBatch.map((text, idx) => ({
      id: randomUUID(),
      vector: embeddingBatch[idx],
      payload: { text, chunkIndex: i + idx },
    }));

    await qdrant.upsert(collectionName, {
      wait: true,
      points,
    });

    total += points.length;
  }

  return total;
}


export async function ingestFilesToProject(files: File[], projectId: string) {
  console.log('ingesting files to project', files);
  for (const file of files) {
    if (!file || file.size === 0) continue;

    const text = await extractTextFromFile(file);
    console.log('text', text);
    if (!text.trim()) {
      console.warn(`[Ingestion] No text extracted from ${file.name}`);
      continue;
    }

    const chunks = await splitTextIntoChunks(text);
    console.log('chunkLength', chunks.length);
    const embeddings = await generateEmbeddings(chunks);
    console.log('embeddingsLength', embeddings.length);
    const chunkCount = await upsertChunks(projectId, chunks, embeddings);
    console.log('chunkCount', chunkCount);
    const contextFile = await createContextFile({
      projectId,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      embedded: false,
      chunkCount,
    });
    console.log('contextFile', contextFile);
  }
}

export async function queryProjectChunks(
  projectId: string,
  query: string
): Promise<Array<{ text: string; score: number }>> {
  const collectionName = getCollectionName(projectId);
  const embedding = await embedText(query);

  const searchResult = await qdrant.search(collectionName, {
    vector: embedding,
    limit: 50, // viele holen, um Auswahl zu ermöglichen
    with_payload: true,
    score_threshold: 0.5,
  });

  const filtered = searchResult
    .map((point) => ({
      text: (point.payload as any).text,
      score: point.score,
      tokens: estimateTokenCount((point.payload as any).text),
    }))
    .sort((a, b) => b.score - a.score);

  const chunks: Array<{ text: string; score: number; tokens: number }> = [];
  let tokenSum = 0;

  for (const chunk of filtered) {
    if (tokenSum + chunk.tokens > 27_000) break;
    chunks.push({ text: chunk.text, score: chunk.score, tokens: chunk.tokens });
    tokenSum += chunk.tokens;
  }

  //console.log(chunks.map(c => ({ score: c.score, tokens: c.tokens, preview: c.text.slice(0, 50) })));

  return chunks;
}

export async function deleteProjectVectorCollection(projectId: string) {
  const collectionName = getCollectionName(projectId);
  try {
    await qdrant.deleteCollection(collectionName);
    console.log(`[Qdrant] Deleted collection: ${collectionName}`);
    return true;
  } catch (err) {
    console.error(`[Qdrant] Failed to delete collection: ${collectionName}`, err);
    return false;
  }
}