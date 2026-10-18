import { db } from "../index";
import { themes as themesTable } from "../schema";
import { SEED_THEMES } from "./themes";

/** Upsert the built-in themes by slug. Idempotent; returns every theme row. */
export async function upsertThemes() {
  for (const theme of SEED_THEMES) {
    await db
      .insert(themesTable)
      .values(theme)
      .onConflictDoUpdate({
        target: themesTable.slug,
        set: {
          name: theme.name,
          category: theme.category,
          description: theme.description,
          config: theme.config,
        },
      });
  }
  return db.select().from(themesTable);
}
