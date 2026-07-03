type UnknownRecord = Record<string, unknown>;

export type AuthPayload = {
  token?: string;
  user?: unknown;
  exp?: number;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const firstString = (...values: unknown[]) =>
  values.find((value): value is string => typeof value === "string" && value.length > 0);

const firstNumber = (...values: unknown[]) =>
  values.find((value): value is number => typeof value === "number" && Number.isFinite(value));

export function getBackendUrl() {
  const backendUrl = process.env.NEXT_PUBLIC_SERVER_URL?.trim();

  if (!backendUrl) {
    return null;
  }

  return backendUrl.replace(/\/$/, "");
}

export function extractAuthPayload(data: unknown): AuthPayload {
  if (!isRecord(data)) {
    return {};
  }

  const nestedCandidates = [data, data.data, data.result, data.doc].filter(isRecord);
  const userSource = nestedCandidates.find((candidate) => candidate.user);
  const tokenSource = nestedCandidates.find((candidate) =>
    firstString(
      candidate.token,
      candidate.accessToken,
      candidate.access_token,
      candidate.jwt,
      candidate.refreshedToken
    )
  );
  const expSource = nestedCandidates.find((candidate) =>
    firstNumber(candidate.exp, candidate.expiresAt)
  );

  return {
    token: tokenSource
      ? firstString(
          tokenSource.token,
          tokenSource.accessToken,
          tokenSource.access_token,
          tokenSource.jwt,
          tokenSource.refreshedToken
        )
      : undefined,
    user: userSource?.user,
    exp: expSource ? firstNumber(expSource.exp, expSource.expiresAt) : undefined,
  };
}

export function extractUser(data: unknown) {
  if (!isRecord(data)) {
    return null;
  }

  const candidates = [data, data.data, data.result, data.doc].filter(isRecord);
  const userSource = candidates.find((candidate) => candidate.user);
  return userSource?.user ?? null;
}

export function extractErrorMessage(data: unknown, fallback: string) {
  if (!isRecord(data)) {
    return fallback;
  }

  const errors = Array.isArray(data.errors) ? data.errors : [];
  const firstError = errors.find(isRecord);

  return (
    firstString(
      firstError?.message,
      data.error,
      data.message,
      isRecord(data.data) ? data.data.error : undefined,
      isRecord(data.data) ? data.data.message : undefined,
      isRecord(data.result) ? data.result.error : undefined,
      isRecord(data.result) ? data.result.message : undefined
    ) || fallback
  );
}
