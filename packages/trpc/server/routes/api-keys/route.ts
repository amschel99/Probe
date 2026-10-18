import { and, desc, eq, schema } from "@repo/database";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { generateApiKey } from "../../api-keys";
import { protectedProcedure, router, sessionProcedure } from "../../trpc";

const MAX_KEYS_PER_USER = 20;

export const apiKeysRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: schema.apiKeys.id,
        name: schema.apiKeys.name,
        prefix: schema.apiKeys.prefix,
        lastUsedAt: schema.apiKeys.lastUsedAt,
        createdAt: schema.apiKeys.createdAt,
      })
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.userId, ctx.user.id))
      .orderBy(desc(schema.apiKeys.createdAt)),
  ),

  /** Returns the plaintext key ONCE — it can't be retrieved again. */
  create: sessionProcedure
    .input(z.object({ name: z.string().trim().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: schema.apiKeys.id })
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.userId, ctx.user.id));
      if (existing.length >= MAX_KEYS_PER_USER) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Limit of ${MAX_KEYS_PER_USER} keys reached — revoke one first`,
        });
      }
      const { key, keyHash, prefix } = generateApiKey();
      const [row] = await ctx.db
        .insert(schema.apiKeys)
        .values({ userId: ctx.user.id, name: input.name, prefix, keyHash })
        .returning({ id: schema.apiKeys.id, name: schema.apiKeys.name, prefix: schema.apiKeys.prefix });
      return { ...row!, key };
    }),

  revoke: sessionProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(schema.apiKeys)
        .where(and(eq(schema.apiKeys.id, input.id), eq(schema.apiKeys.userId, ctx.user.id)))
        .returning({ id: schema.apiKeys.id });
      if (deleted.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),
});
