import { embedText } from '@/lib/ai/embed';
import { randomUUID } from 'crypto';
import { qdrant } from './qdrant';

const VECTOR_SIZE = 1536; // OpenAI embedding size
const DISTANCE = 'Cosine';

function getCollectionName(projectId: string) {
  return `project_${projectId}`;
}

export async function upsertProjectChunk(projectId: string, text: string, metadata: Record<string, any> = {}) {
  try {
    const collectionName = getCollectionName(projectId);
    console.log('collectionName', collectionName);

    const { collections } = await qdrant.getCollections();
    console.log('collections', collections);
    const exists = collections.some((c) => c.name === collectionName);
    console.log('exists', exists);

    if (!exists) {
      console.log(`[Qdrant] Creating new collection: ${collectionName}`);
      await qdrant.createCollection(collectionName, {
        vectors: {
          size: VECTOR_SIZE,
          distance: DISTANCE,
        },
      });
    }

    const embedding = await embedText(text);

    const point = {
      id: randomUUID(),
      vector: embedding,
      payload: {
        text,
        ...metadata,
      },
    };

    await qdrant.upsert(collectionName, {
      wait: true,
      points: [point],
    });

    return point.id;
  } catch (err) {
    console.error('[Qdrant] Failed to upsert chunk:', err);
    throw err;
  }
}

export async function queryProjectChunks(
  projectId: string,
  query: string,
  topK: number = 5
): Promise<Array<{ text: string; score: number }>> {
  const collectionName = getCollectionName(projectId);

  const embedding = await embedText(query);

  const searchResult = await qdrant.search(collectionName, {
    vector: embedding,
    limit: topK,
    with_payload: true,
    score_threshold: 0.75,
  });

  return searchResult.map((point) => ({
    text: (point.payload as any).text,
    score: point.score,
  }));
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