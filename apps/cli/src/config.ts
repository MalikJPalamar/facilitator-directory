/**
 * Resolved runtime context for one CLI invocation. Threaded into every command
 * and into `api()` so transport (base URL, key) and presentation (json) are
 * decided once, at the edge, from flags-over-env precedence.
 */
export type Ctx = {
  baseUrl: string;
  key?: string;
  json: boolean;
};

/**
 * A user-facing configuration/usage error (bad flags, missing base URL). The
 * top-level handler prints these as `error: <message>` and exits 2 — distinct
 * from network/API failures (ApiError) and unexpected crashes.
 */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

/**
 * Resolve transport + output config with flags overriding env:
 *   --base-url > DIRECTORY_BASE_URL   and   --key > DIRECTORY_API_KEY.
 * Trailing slashes are stripped so callers can pass either form; the `/api`
 * suffix is appended later in `api()`. Throws CliError when no base URL is set
 * (every command needs an origin to talk to).
 */
export function resolveConfig(g: { baseUrl?: string; key?: string; json?: boolean }): Ctx {
  const rawBase = g.baseUrl ?? process.env.DIRECTORY_BASE_URL;
  if (!rawBase) {
    throw new CliError(
      "no base URL — pass --base-url <url> or set DIRECTORY_BASE_URL",
    );
  }
  const baseUrl = rawBase.replace(/\/+$/, "");
  const key = g.key ?? process.env.DIRECTORY_API_KEY;
  return { baseUrl, key, json: Boolean(g.json) };
}
