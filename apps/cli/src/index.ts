#!/usr/bin/env node
import { parseArgs } from "node:util";

import { resolveConfig, type Ctx } from "./config.ts";
import { printErr } from "./output.ts";

import * as branding from "./commands/branding.ts";
import * as insights from "./commands/insights.ts";
import * as keys from "./commands/keys.ts";
import * as leads from "./commands/leads.ts";
import * as profile from "./commands/profile.ts";
import * as reviews from "./commands/reviews.ts";
import * as roster from "./commands/roster.ts";
import * as school from "./commands/school.ts";
import * as search from "./commands/search.ts";
import * as webhooks from "./commands/webhooks.ts";

type Command = {
  usage: string;
  run: (argv: string[], ctx: Ctx) => Promise<void>;
};

/** noun → command module. Each conforms to { usage, run }. */
const COMMANDS: Record<string, Command> = {
  search,
  school,
  profile,
  leads,
  roster,
  keys,
  webhooks,
  branding,
  reviews,
  insights,
};

function buildUsage(): string {
  const lines = [
    "directory — a thin HTTP client for The Directory REST API",
    "",
    "Usage: directory [--base-url <url>] [--key <key>] [--json] <command> [args]",
    "",
    "Global flags:",
    "  --base-url <url>   API origin (or DIRECTORY_BASE_URL); /api is appended",
    "  --key <key>        Bearer API key (or DIRECTORY_API_KEY)",
    "  --json             print raw JSON instead of tables",
    "  -h, --help         show this help",
    "",
    "Commands:",
  ];
  for (const cmd of Object.values(COMMANDS)) {
    for (const l of cmd.usage.split("\n")) lines.push(`  ${l}`);
  }
  return lines.join("\n");
}

/** Global flags valid before the command name. */
const GLOBAL_OPTIONS = {
  "base-url": { type: "string" },
  key: { type: "string" },
  json: { type: "boolean" },
  help: { type: "boolean" },
  h: { type: "boolean" },
} as const;

/**
 * Split argv into the leading global-flag run and the command + its own argv.
 * We can't parse the whole argv with one strict:false parseArgs — it would
 * swallow per-command flags (e.g. treat `--school` as a global boolean and drop
 * its value). So we peel only the leading slice up to the first bare token (the
 * command name), then hand the remainder to the command verbatim.
 */
function split(args: string[]): { head: string[]; name?: string; rest: string[] } {
  const valued = new Set(["--base-url", "--key"]);
  let i = 0;
  while (i < args.length) {
    const a = args[i]!;
    if (!a.startsWith("-")) break; // first positional → the command
    if (valued.has(a)) {
      i += 2; // flag + its value
    } else if (a.startsWith("--") && a.includes("=")) {
      i += 1; // --base-url=... form
    } else {
      i += 1; // boolean flag (--json/--help/-h) or unknown
    }
  }
  return { head: args.slice(0, i), name: args[i], rest: args.slice(i + 1) };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { head, name, rest } = split(argv);

  // Parse ONLY the leading global flags (strict:false tolerates -h etc.).
  const { values } = parseArgs({
    args: head,
    options: GLOBAL_OPTIONS,
    allowPositionals: true,
    strict: false,
  });

  const wantHelp = Boolean(values.help || values.h);
  if (!name || wantHelp) {
    process.stdout.write(`${buildUsage()}\n`);
    return;
  }

  const cmd = COMMANDS[name];
  if (!cmd) {
    process.stderr.write(`unknown command "${name}"\n\n${buildUsage()}\n`);
    process.exitCode = 2;
    return;
  }

  const ctx = resolveConfig({
    baseUrl: values["base-url"] as string | undefined,
    key: values.key as string | undefined,
    json: values.json as boolean | undefined,
  });
  await cmd.run(rest, ctx);
}

main().catch((e) => {
  process.exitCode = printErr(e);
});
