const API_V1_SUFFIX = "/api/v1";

export function getApiV1BaseUrl(rawBaseUrl?: string): string {
  const normalized = (rawBaseUrl ?? "")
    .split("#", 1)[0]
    .trim()
    .replace(/\/+$/, "");
  if (!normalized) {
    return "";
  }

  return normalized.endsWith(API_V1_SUFFIX)
    ? normalized
    : `${normalized}${API_V1_SUFFIX}`;
}
