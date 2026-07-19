function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractConversationItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  const root = asRecord(data);
  if (!root) return [];
  if (Array.isArray(root.result)) return root.result as T[];
  if (Array.isArray(root.docs)) return root.docs as T[];
  const nestedResult = asRecord(root.result);
  if (Array.isArray(nestedResult?.docs)) return nestedResult.docs as T[];
  return [];
}

function pagination(data: unknown): { hasNextPage: boolean; totalPages: number } {
  const root = asRecord(data);
  const nestedResult = asRecord(root?.result);
  const totalPages = Number(root?.totalPages || nestedResult?.totalPages || 1);
  const hasNextPage = Boolean(root?.hasNextPage || nestedResult?.hasNextPage);
  return { hasNextPage, totalPages };
}

export async function fetchAllConversations<T>(): Promise<T[]> {
  const conversations: T[] = [];
  let page = 1;

  while (page <= 100) {
    const res = await fetch(`/api/chat/conversations?limit=100&page=${page}`, {
      method: "GET",
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch conversations (${res.status})`);
    }

    const data = await res.json();
    conversations.push(...extractConversationItems<T>(data));

    const { hasNextPage, totalPages } = pagination(data);
    if (!hasNextPage && page >= totalPages) break;
    page += 1;
  }

  return conversations;
}
