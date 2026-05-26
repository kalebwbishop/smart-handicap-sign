export function getApiV1BaseUrl(rawBaseUrl?: string): string {
  const normalized = (rawBaseUrl ?? "").replace(/\/+$/, "");
  return `${normalized}/api/v1`;
}
