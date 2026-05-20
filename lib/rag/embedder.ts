import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY!,
  baseURL: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1",
});

const MODEL = process.env.EMBEDDING_MODEL || "BAAI/bge-m3";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await client.embeddings.create({
    model: MODEL,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}
