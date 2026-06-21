import { runNightly } from "@directory/core";
import { queryClient } from "@directory/db";

/**
 * The nightly LEARN loop now lives in @directory/core (`runNightly`) so it can
 * be triggered both here (the always-on worker) and from the serverless cron
 * route. This module is the worker's CLI entrypoint: `pnpm intelligence:nightly`
 * runs one pass and closes the DB connection on exit.
 */
export { runNightly };

if (import.meta.url === `file://${process.argv[1]}`) {
  runNightly()
    .then(() => queryClient.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
