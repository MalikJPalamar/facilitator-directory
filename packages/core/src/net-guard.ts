import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF egress guard for caller-supplied webhook URLs. The server makes
 * authenticated-from-inside POSTs to these targets, so an attacker who can
 * register an endpoint pointing at internal infra (cloud metadata at
 * 169.254.169.254, RFC1918 ranges, loopback, link-local) could pivot into the
 * private network. We require https + a PUBLIC resolved address, and re-check at
 * delivery time so DNS rebinding (public at register, private at delivery) fails.
 */

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

/** True for loopback / private / link-local / CGNAT / metadata addresses. */
export function isBlockedAddress(addr: string): boolean {
  const fam = isIP(addr);
  if (fam === 4) return isBlockedV4(addr);
  if (fam === 6) return isBlockedV6(addr);
  return true; // unparseable -> block
}

function isBlockedV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255))
    return true;
  const [a, b] = p as [number, number, number, number];
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this" network
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  // IPv4-mapped (::ffff:1.2.3.4) — check the embedded v4.
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1] as string);
  const head = lower.split(":")[0] ?? "";
  const first = parseInt(head || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  return false;
}

/**
 * Validate a webhook target: https only, and every resolved IP must be public.
 * Throws BlockedUrlError on any violation. Call at registration AND delivery.
 */
export async function assertPublicHttpsUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("invalid url");
  }
  if (url.protocol !== "https:") throw new BlockedUrlError("url must be https");

  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip [..] for IPv6 literals
  // Literal IP in the URL — check directly (no DNS).
  if (isIP(host)) {
    if (isBlockedAddress(host))
      throw new BlockedUrlError("url resolves to a private address");
    return;
  }

  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new BlockedUrlError("hostname did not resolve");
  }
  if (addrs.length === 0) throw new BlockedUrlError("hostname did not resolve");
  for (const a of addrs) {
    if (isBlockedAddress(a.address))
      throw new BlockedUrlError("url resolves to a private address");
  }
}
