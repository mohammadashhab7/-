export function imgSrc(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/objects/")) {
    return `/api/storage${url}`;
  }
  return url;
}
