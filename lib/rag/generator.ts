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

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface GenerateParams {
  question: string;
  chunks: Chunk[];
  history?: ChatHistoryMessage[];
}

const SYSTEM_PROMPT = `你是一个企业知识库问答助手。请严格基于以下提供的文档片段回答问题。
对话历史只用于理解用户追问、省略指代和上下文衔接，不得替代知识库文档作为事实来源。
如果文档片段足以回答问题，请给出准确、简洁的回答。
如果文档片段不足以回答问题，请明确回答："当前知识库中没有足够信息来回答这个问题。"
不要编造任何知识库中没有的信息。回答使用中文。`;

const REWRITE_PROMPT = `你负责把多轮对话中的最新问题改写成适合知识库检索的独立问题。
只输出改写后的问题，不要解释。
如果最新问题已经完整，原样输出。
不要添加对话中没有的信息。`;

function buildContext(chunks: Chunk[]): string {
  return chunks
    .map(
      (chunk, i) =>
        `[来源 ${i + 1}: ${chunk.chunk_filename}（第 ${chunk.chunk_index + 1} 段）]\n${chunk.chunk_content}`
    )
    .join("\n\n");
}

function buildAnswerMessages(params: GenerateParams) {
  const { question, chunks, history = [] } = params;
  const context = buildContext(chunks);

  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: "user" as const,
      content: `知识库文档片段：\n${context || "无匹配文档片段"}\n\n用户问题：${question}`,
    },
  ];
}

export async function generateAnswer(params: GenerateParams): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_tokens: 1024,
    messages: buildAnswerMessages(params),
  });

  const content = response.choices[0]?.message?.content;
  return content ?? "模型未返回有效回答。";
}

export async function* streamAnswer(
  params: GenerateParams
): AsyncGenerator<string> {
  const stream = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_tokens: 1024,
    stream: true,
    messages: buildAnswerMessages(params),
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}

export async function rewriteSearchQuestion(params: {
  question: string;
  history: ChatHistoryMessage[];
}): Promise<string> {
  const { question, history } = params;

  if (history.length === 0) return question;

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 160,
    messages: [
      { role: "system", content: REWRITE_PROMPT },
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      { role: "user", content: question },
    ],
  });

  const rewritten = response.choices[0]?.message?.content?.trim();
  return rewritten || question;
}
