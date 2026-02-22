/**
 * Builds API URLs used by admin client components.
 *
 * Default behavior:
 * - Uses same-origin paths (e.g. `/api/v1/stats`) so Next.js rewrites can proxy
 *   requests to the local API server.
 *
 * Optional override:
 * - Set `NEXT_PUBLIC_ADMIN_API_PREFIX` (for example `http://localhost:6129`)
 *   to bypass rewrites and call an absolute origin directly.
 */
const apiPrefix = (process.env.NEXT_PUBLIC_ADMIN_API_PREFIX ?? "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiPrefix}${normalizedPath}`;
}

