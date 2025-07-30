import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = 'text-embedding-3-small';

export async function embedBatch(batch: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: MODEL,
    input: batch,
    encoding_format: 'float',
  });

  return response.data.map((d) => d.embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: MODEL,
    input: text,
    encoding_format: 'float',
  });

  return res.data[0].embedding;
}