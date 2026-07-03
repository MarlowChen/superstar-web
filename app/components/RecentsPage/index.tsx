"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

interface ConversationListItem {
  id: string;
  title?: string;
  summary?: string;
  updatedAt?: string;
}

const formatDate = (value?: string, locale = "en") => {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString(locale === "zh-TW" ? "zh-TW" : locale === "ja" ? "ja-JP" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

export default function RecentsPage() {
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "en";
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);

  const copy = {
    title: locale === "zh-TW" ? "全部對話" : locale === "ja" ? "すべての会話" : "All chats",
    subtitle:
      locale === "zh-TW"
        ? "在這裡快速找到所有歷史對話。"
        : locale === "ja"
          ? "ここですべての履歴会話をすばやく探せます。"
          : "Browse and reopen your full conversation history.",
    search:
      locale === "zh-TW"
        ? "搜尋對話名稱"
        : locale === "ja"
          ? "会話を検索"
          : "Search conversations",
    empty:
      locale === "zh-TW"
        ? "目前沒有找到對話。"
        : locale === "ja"
          ? "会話が見つかりません。"
          : "No conversations found.",
    count:
      locale === "zh-TW"
        ? "筆對話"
        : locale === "ja"
          ? "件の会話"
          : "conversations",
    open:
      locale === "zh-TW"
        ? "開啟"
        : locale === "ja"
          ? "開く"
          : "Open",
    loading:
      locale === "zh-TW"
        ? "載入中..."
        : locale === "ja"
          ? "読み込み中..."
          : "Loading...",
  };

  useEffect(() => {
    let cancelled = false;

    const fetchConversations = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/chat/conversations", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          if (!cancelled) setConversations([]);
          return;
        }

        const data = await res.json();
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.result)
            ? data.result
            : Array.isArray(data?.docs)
              ? data.docs
              : Array.isArray(data?.result?.docs)
                ? data.result.docs
                : [];

        if (!cancelled) {
          setConversations(items);
        }
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
        if (!cancelled) setConversations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchConversations();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredConversations = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return conversations;

    return conversations.filter((conversation) => {
      const title = (conversation.title || conversation.summary || "").toLowerCase();
      return title.includes(keyword);
    });
  }, [conversations, query]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7fbff] text-[#10243a] dark:bg-[#09111b] dark:text-[#eff7ff]">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col px-6 pb-8 pt-20 md:px-10 md:py-8">
        <div className="shrink-0 space-y-6">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#89a0b5] dark:text-[#6f8ba6]">
              Workspace
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-normal">{copy.title}</h1>
                <p className="text-sm text-[#58718a] dark:text-[#a6bed2]">{copy.subtitle}</p>
              </div>
              <div className="text-sm text-[#89a0b5] dark:text-[#6f8ba6]">
                {filteredConversations.length} {copy.count}
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.search}
              className="h-11 w-full rounded-2xl border border-[rgba(125,165,201,0.16)] bg-white/92 px-4 text-sm text-[#10243a] outline-none transition placeholder:text-[#89a0b5] focus:border-[#53c7ff] dark:border-[rgba(122,172,214,0.14)] dark:bg-[#101a26] dark:text-[#eff7ff] dark:placeholder:text-[#6f8ba6]"
            />
          </div>

        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <div className="px-5 py-10 text-sm text-[#89a0b5] dark:text-[#6f8ba6]">
              {copy.loading}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-5 py-10 text-sm text-[#89a0b5] dark:text-[#6f8ba6]">
              {copy.empty}
            </div>
          ) : (
            <div className="content-scrollbar h-full overflow-y-auto divide-y divide-[rgba(125,165,201,0.14)] pr-1 dark:divide-[rgba(122,172,214,0.12)]">
              {filteredConversations.map((conversation) => {
                const label =
                  conversation.title || conversation.summary || "New conversation";

                return (
                  <Link
                    key={conversation.id}
                    href={`/${locale}/drawing?conversationId=${conversation.id}`}
                    className="group flex items-center justify-between gap-4 rounded-2xl px-4 py-4 transition hover:bg-[#eef5fb] dark:hover:bg-[#101a26]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[#10243a] group-hover:text-[#0c6fba] dark:text-[#eff7ff] dark:group-hover:text-[#53c7ff]">
                        {label}
                      </div>
                      {conversation.updatedAt ? (
                        <div className="mt-1 text-xs text-[#89a0b5] dark:text-[#6f8ba6]">
                          {formatDate(conversation.updatedAt, locale)}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-xs text-[#89a0b5] opacity-0 transition-opacity group-hover:opacity-100 dark:text-[#6f8ba6]">
                      {copy.open}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
