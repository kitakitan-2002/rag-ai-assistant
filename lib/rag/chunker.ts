import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const CHUNK_SIZE = Number(process.env.CHUNK_SIZE) || 500;
const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP) || 50;

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  separators: ["\n\n", "\n", "。", ".", "！", "？", "；", " "],
});

export async function chunk(text: string): Promise<string[]> {
  const chunks = await splitter.splitText(text);
  return chunks.map((item) => item.trim()).filter(Boolean);
}
