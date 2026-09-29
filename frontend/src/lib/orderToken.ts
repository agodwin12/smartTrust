/**
 * The guest tracking token goes to the API in a header rather than in the request URL, so it
 * never lands in server access logs, proxies or analytics.
 */
export const orderTokenHeader = (token?: string | null): Record<string, string> | undefined => (token ? { "X-Order-Token": token } : undefined);
