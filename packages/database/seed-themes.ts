/**
 * Load ONLY the built-in themes — no demo users, forms or responses. Safe for
 * production; runs automatically after the schema push in docker-start.sh.
 * Run with: pnpm db:themes
 */
import "dotenv/config";

import { upsertThemes } from "./seed/upsert-themes";

upsertThemes()
  .then((rows) => {
    console.log(`✓ Themes upserted (${rows.length})`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Theme upsert failed:", err);
    process.exit(1);
  });
