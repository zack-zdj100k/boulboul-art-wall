// Browser-side fetch helper. Errors carry stable i18n codes from the API (never raw messages).

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public fields: Record<string, string> = {},
  ) {
    super(code);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "errors.network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { code?: string; fields?: Record<string, string> } }).error;
    throw new ApiError(res.status, err?.code ?? "errors.generic", err?.fields ?? {});
  }
  return data as T;
}
