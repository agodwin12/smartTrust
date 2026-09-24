// In the browser the public URL is used; on the server (SSR, sitemap, route handlers) an
// internal address can be preferred — inside Docker that is http://backend:5000/api, which
// skips the public reverse proxy entirely.
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";
export const API_URL = ((typeof window === "undefined" && process.env.API_INTERNAL_URL) || PUBLIC_API_URL).replace(/\/?$/, "/");

/** Absolute URL for an API path — used for full-page navigations such as the Google OAuth start. */
export const apiUrl = (path: string) => new URL(path.replace(/^\//, ""), API_URL).toString();

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export type FetchOptions = Omit<RequestInit, "body"> & {
  params?: QueryParams;
  /** JSON body — serialised automatically. */
  body?: unknown;
  token?: string | null;
  next?: { revalidate?: number | false; tags?: string[] };
};

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "REQUEST_FAILED"
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/**
 * Thin fetch wrapper around the Express API: builds "<API_URL>/<path>?params",
 * sends/receives JSON, forwards the refresh cookie, and throws ApiRequestError
 * with the backend's { error, code } on non-2xx.
 */
export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, body, token, headers, ...init } = options;
  const url = new URL(path.replace(/^\//, ""), API_URL);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
  }

  // FormData (file uploads) goes through untouched so the browser sets the multipart boundary.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const res = await fetch(url.toString(), {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: isForm ? body : JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;

  if (!res.ok) {
    throw new ApiRequestError(res.status, data?.error ?? `Request failed (${res.status})`, data?.code);
  }

  return data as T;
}

export const isNotFound = (error: unknown) => error instanceof ApiRequestError && error.status === 404;
