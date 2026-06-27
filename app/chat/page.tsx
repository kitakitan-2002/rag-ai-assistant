"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";

interface Source {
  document_id: string;
  filename: string;
  chunk_index: number;
  content_preview: string;
  similarity?: number;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  created_at: string;
}

interface ChatStreamPayload {
  conversation?: Conversation;
  sources?: Source[];
  content?: string;
  error?: string;
}

interface ChatStreamEvent {
  event: string;
  data: ChatStreamPayload;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseSseBlock(block: string): ChatStreamEvent | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  if (dataLines.length === 0) return null;

  return {
    event,
    data: JSON.parse(dataLines.join("\n")) as ChatStreamPayload,
  };
}

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("demo_access_password") ?? "";
  });

  const buildHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...(password ? { "x-demo-password": password } : {}),
    }),
    [password]
  );

  const fetchConversations = useCallback(async () => {
    setHistoryLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/conversations", {
        headers: buildHeaders(),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error((json as { error?: string })?.error ?? "获取对话列表失败");
      }

      const nextConversations = json as Conversation[];
      setConversations(nextConversations);
      setActiveConversationId((current) => {
        if (current || nextConversations.length === 0) return current;
        return nextConversations[0].id;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取对话列表失败");
      setConversations([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [buildHeaders]);

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`, {
          headers: buildHeaders(),
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error((json as { error?: string })?.error ?? "获取消息失败");
        }

        setError(null);
        setMessages(json as ChatMessage[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取消息失败");
        setMessages([]);
      }
    },
    [buildHeaders]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchConversations();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [fetchConversations]);

  useEffect(() => {
    if (!activeConversationId) return;

    const timer = window.setTimeout(() => {
      void fetchMessages(activeConversationId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeConversationId, fetchMessages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversationId ?? "pending",
      role: "user",
      content: trimmed,
      sources: [],
      created_at: new Date().toISOString(),
    };

    setLoading(true);
    setError(null);
    setQuestion("");
    setMessages((prev) => [...prev, optimisticMessage]);

    const assistantMessageId = `temp-assistant-${Date.now()}`;
    let assistantStarted = false;
    let serverAccepted = false;
    let streamConversationId = activeConversationId;

    const appendAssistantDelta = (content: string) => {
      if (!assistantStarted) {
        assistantStarted = true;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            conversation_id: streamConversationId ?? "pending",
            role: "assistant",
            content: "",
            sources: [],
            created_at: new Date().toISOString(),
          },
        ]);
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMessageId
            ? { ...message, content: message.content + content }
            : message
        )
      );
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          question: trimmed,
          conversationId: activeConversationId,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error((json as { error?: string })?.error ?? "请求失败");
      }

      if (!res.body) {
        throw new Error("浏览器不支持流式响应");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let doneReceived = false;

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const parsed = parseSseBlock(block);
          if (!parsed) continue;

          if (parsed.event === "meta" && parsed.data.conversation) {
            serverAccepted = true;
            streamConversationId = parsed.data.conversation.id;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === optimisticMessage.id
                  ? {
                      ...message,
                      conversation_id: parsed.data.conversation?.id ?? "pending",
                    }
                  : message
              )
            );
          }

          if (parsed.event === "delta" && parsed.data.content) {
            appendAssistantDelta(parsed.data.content);
          }

          if (parsed.event === "error") {
            throw new Error(parsed.data.error ?? "请求失败");
          }

          if (parsed.event === "done" && parsed.data.conversation) {
            doneReceived = true;
            streamConversationId = parsed.data.conversation.id;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      conversation_id: parsed.data.conversation?.id ?? "pending",
                      sources: parsed.data.sources ?? [],
                    }
                  : message
              )
            );
          }
        }
      }

      if (buffer.trim()) {
        const parsed = parseSseBlock(buffer);
        if (parsed?.event === "error") {
          throw new Error(parsed.data.error ?? "请求失败");
        }
      }

      if (!doneReceived || !streamConversationId) {
        throw new Error("流式响应异常结束");
      }

      setActiveConversationId(streamConversationId);
      await fetchMessages(streamConversationId);
      await fetchConversations();
    } catch (err) {
      setMessages((prev) => {
        const failedIds = new Set([assistantMessageId]);
        if (!serverAccepted) failedIds.add(optimisticMessage.id);
        return prev.filter((message) => !failedIds.has(message.id));
      });
      setQuestion(trimmed);
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setQuestion("");
    setError(null);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-14">
      <div className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          RAG Chat
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          智能问答
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          基于已上传知识库进行多轮问答，系统会保存对话历史并用于理解上下文追问。
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="whitespace-nowrap text-sm font-medium text-slate-600">
          演示密码
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            localStorage.setItem("demo_access_password", e.target.value);
          }}
          placeholder="请输入演示密码"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <button
          type="button"
          onClick={() => void fetchConversations()}
          disabled={historyLoading}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {historyLoading ? "刷新中" : "刷新历史"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-950">对话历史</h2>
            <button
              type="button"
              onClick={startNewConversation}
              className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              新对话
            </button>
          </div>
          <div className="max-h-[520px] overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                暂无历史对话
              </p>
            ) : (
              <div className="space-y-1">
                {conversations.map((conversation) => {
                  const active = conversation.id === activeConversationId;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setActiveConversationId(conversation.id)}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                        active
                          ? "bg-slate-950 text-white"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block truncate font-medium">
                        {conversation.title}
                      </span>
                      <span
                        className={`mt-1 block text-xs ${
                          active ? "text-slate-300" : "text-slate-400"
                        }`}
                      >
                        {formatTime(conversation.updated_at)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="min-h-[420px] rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            {messages.length === 0 ? (
              <div className="flex min-h-[360px] items-center justify-center text-center">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    开始一个问题
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    后续追问会自动带上当前对话的上下文。
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[82%] rounded-md border px-4 py-3 ${
                        message.role === "user"
                          ? "border-slate-900 bg-slate-950 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-800"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-7">
                        {message.content}
                      </p>

                      {message.role === "assistant" &&
                      message.sources?.length > 0 ? (
                        <div className="mt-4 border-t border-slate-200 pt-3">
                          <p className="text-xs font-semibold text-slate-500">
                            来源引用
                          </p>
                          <div className="mt-2 space-y-2">
                            {message.sources.map((source, i) => (
                              <div
                                key={`${message.id}-${source.document_id}-${source.chunk_index}`}
                                className="rounded-md border border-slate-200 bg-white p-3"
                              >
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span className="font-semibold text-slate-700">
                                    来源 {i + 1}
                                  </span>
                                  <span>|</span>
                                  <span>{source.filename}</span>
                                  <span>|</span>
                                  <span>第 {source.chunk_index + 1} 段</span>
                                  {typeof source.similarity === "number" ? (
                                    <>
                                      <span>|</span>
                                      <span>
                                        相似度{" "}
                                        {(source.similarity * 100).toFixed(1)}%
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-xs leading-5 text-slate-600">
                                  {source.content_preview}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}

                {loading ? (
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <svg
                      className="h-4 w-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    正在结合上下文检索知识库...
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="请输入问题，也可以直接追问上一轮回答"
              disabled={loading}
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {loading ? "处理中..." : "发送"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
