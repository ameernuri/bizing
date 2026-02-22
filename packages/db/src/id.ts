import KSUID from "ksuid";

function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * KSUID-based id generator.
 *
 * - With no tag: `34charKSUID...`
 * - With tag: `booking_34charKSUID...`
 */
export function generateId(tag = ""): string {
  const ksuid = KSUID.randomSync().string;
  const safeTag = normalizeTag(tag);
  return safeTag ? `${safeTag}_${ksuid}` : ksuid;
}
