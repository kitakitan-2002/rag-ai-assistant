import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
});

const MODEL = process.env.DEEPSEEK_CHAT_MODEL || "deepseek-chat";

interface Chunk {
  chunk_content: string;
  chunk_filename: string;
  chunk_index: number;
}

interface GenerateParams {
  question: string;
  chunks: Chunk[];
}

const SYSTEM_PROMPT = `你是一个企业知识库问答助手。请严格基于以下提供的文档片段回答问题。
如果上下文足以回答问题，请给出准确、简洁的回答。
如果上下文不足以回答问题，请明确回答："当前知识库中没有足够信息来回答这个问题。"
不要编造任何知识库中没有的信息。回答使用中文。`;

function buildContext(chunks: Chunk[]): string {
  return chunks
    .map(
      (chunk, i) =>
        `[来源 ${i + 1}: ${chunk.chunk_filename}（第 ${chunk.chunk_index + 1} 段）]\n${chunk.chunk_content}`
    )
    .join("\n\n");
}

export async function generateAnswer(params: GenerateParams): Promise<string> {
  const { question, chunks } = params;

  const context = buildContext(chunks);

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_tokens: 1024,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${context}\n\n用户问题：${question}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  return content ?? "模型未返回有效回答。";
}
