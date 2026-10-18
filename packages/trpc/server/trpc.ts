import { eq, schema } from "@repo/database";
import { OwnershipError } from "@repo/services";
import { initTRPC, TRPCError } from "@trpc/server";
import type { OpenApiMeta } from "trpc-to-openapi";
import superjson from "superjson";
import { ZodError } from "zod";

import type { Context } from "./context";

// superjson preserves Date/Map/Set across the wire for the /trpc surface (the
// web client uses the matching transformer). trpc-to-openapi's REST generation
// doesn't support a transformer, so the api app generates its OpenAPI doc with a
// resilient fallback — the /trpc surface is the source of truth.
const t = initTRPC
  .meta<OpenApiMeta>()
  .context<Context>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      };
    },
  });

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

// Authenticated by either a browser session or a personal API key (see
// context.ts). `ctx.session` is null for API-key requests.
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Maps `OwnershipError` (thrown by @repo/services' assertFormOwner/
 * assertFieldOwner — which are transport-agnostic and do NOT throw a
 * TRPCError) onto a tRPC NOT_FOUND so ownership failures surface correctly.
 */
const mapOwnershipError = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (e) {
    if (e instanceof OwnershipError) {
      throw new TRPCError({ code: "NOT_FOUND", message: e.message });
    }
    throw e;
  }
});

export const protectedProcedure = t.procedure.use(isAuthed).use(mapOwnershipError);

/** Browser session only — API keys can't manage API keys. */
export const sessionProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.authMethod !== "session") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sign in to the dashboard to do this" });
  }
  return next();
});

/**
 * Verifies the current user is an admin by querying the `role` column directly
 * from the DB. We deliberately do NOT trust `ctx.user.role`: Better Auth may
 * not surface custom columns on the session user, so the source of truth is the
 * `users` table. The verified role is passed down in ctx for convenience.
 */
const isAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const row = await ctx.db.query.users.findFirst({
    where: eq(schema.users.id, ctx.user.id),
    columns: { role: true },
  });
  if (!row || row.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admins only" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      role: row.role,
    },
  });
});

export const adminProcedure = protectedProcedure.use(isAdmin);
