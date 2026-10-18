import { and, desc, eq, gte, lte, schema, sql } from "@repo/database";
import { assertFormOwner } from "@repo/services";
import { listResponsesSchema } from "@repo/services/validators";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../../trpc";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (Array.isArray(value)) s = value.join(", ");
  else if (typeof value === "object") s = JSON.stringify(value);
  else s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export const responsesRouter = router({
  list: protectedProcedure.input(listResponsesSchema).query(async ({ ctx, input }) => {
    await assertFormOwner(ctx.db, input.formId, ctx.user.id);
    // Include each response's values in the SAME query — the report table reads
    // them directly, so there's no per-row N+1 fetch on the client.
    const rows = await ctx.db.query.responses.findMany({
      where: and(
        eq(schema.responses.formId, input.formId),
        input.from ? gte(schema.responses.createdAt, new Date(input.from)) : undefined,
        input.to ? lte(schema.responses.createdAt, new Date(input.to)) : undefined,
        // Keyset pagination: the cursor is the last row's id; compare in SQL so
        // Postgres' microsecond timestamps stay exact (JS Dates are ms only).
        input.cursor
          ? sql`(${schema.responses.createdAt}, ${schema.responses.id}) < (select r.created_at, r.id from responses r where r.id = ${input.cursor})`
          : undefined,
      ),
      with: { values: true },
      orderBy: (r, { desc }) => [desc(r.createdAt), desc(r.id)],
      limit: input.limit + 1,
    });
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.query.responses.findFirst({
        where: eq(schema.responses.id, input.id),
        with: { values: { with: { field: true } }, form: { columns: { userId: true, title: true } } },
      });
      if (!row || row.form.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.query.responses.findFirst({
        where: eq(schema.responses.id, input.id),
        with: { form: { columns: { userId: true, id: true } } },
      });
      if (!row || row.form.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.transaction(async (tx) => {
        await tx.delete(schema.responses).where(eq(schema.responses.id, input.id));
        await tx
          .update(schema.forms)
          .set({ responseCount: sql`greatest(${schema.forms.responseCount} - 1, 0)` })
          .where(eq(schema.forms.id, row.form.id));
      });
      return { ok: true };
    }),

  exportCsv: protectedProcedure
    .input(z.object({ formId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertFormOwner(ctx.db, input.formId, ctx.user.id);
      const form = await ctx.db.query.forms.findFirst({
        where: eq(schema.forms.id, input.formId),
        with: { fields: { orderBy: (f, { asc }) => [asc(f.order)] } },
      });
      if (!form) throw new TRPCError({ code: "NOT_FOUND" });

      const rows = await ctx.db.query.responses.findMany({
        where: eq(schema.responses.formId, input.formId),
        with: { values: true },
        orderBy: (r, { desc }) => [desc(r.createdAt)],
      });

      const fieldIds = form.fields.map((f) => f.id);
      const header = [
        "id",
        "submitted_at",
        "submitter_email",
        "submitter_name",
        "completion_ms",
        ...form.fields.map((f) => f.label),
      ];

      const lines = [header.map(csvEscape).join(",")];
      for (const r of rows) {
        const byField = new Map(r.values.map((v) => [v.fieldId, v.value]));
        const line = [
          r.id,
          r.createdAt.toISOString(),
          r.submitterEmail ?? "",
          r.submitterName ?? "",
          r.completionTime ?? "",
          ...fieldIds.map((id) => csvEscape(byField.get(id))),
        ];
        lines.push(line.map(csvEscape).join(","));
      }
      return { csv: lines.join("\n"), filename: `${form.slug}-responses.csv` };
    }),
});
