"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { trpc } from "@/lib/trpc";

import { FormTabs } from "../_components/form-tabs";

export default function AnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const formQuery = trpc.forms.get.useQuery({ id });
  const analyticsQuery = trpc.forms.getAnalytics.useQuery({ id });

  if (!formQuery.data || !analyticsQuery.data) return <p className="text-probe-700">Loading…</p>;

  const a = analyticsQuery.data;
  const topField = a.topDropoffFieldId
    ? formQuery.data.fields.find((f) => f.id === a.topDropoffFieldId)?.label ?? "Unknown"
    : null;

  return (
    <div className="space-y-6">
      <FormTabs id={id} responseCount={formQuery.data.responseCount} />

      <div>
        <div className="text-xs text-probe-700">
          <Link href={`/dashboard/forms/${id}`} className="hover:underline">
            {formQuery.data.title}
          </Link>
        </div>
        <h1 className="display text-3xl font-bold">Analytics</h1>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Stat label="Views" value={a.eventCounts.view ?? 0} />
        <Stat label="Starts" value={a.eventCounts.start ?? 0} />
        <Stat label="Submissions" value={a.eventCounts.submit ?? 0} />
        <Stat label="Completion %" value={`${a.completionRate}%`} />
      </div>

      <div className="card">
        <h2 className="display text-xl font-bold mb-4">Submissions (last 30 days)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={a.daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5D5BD" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#B8722E" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="display text-lg font-bold mb-2">Top drop-off field</h3>
          <p className="text-probe-700">
            {topField ?? "Not enough abandon events to determine yet."}
          </p>
        </div>
        <div className="card">
          <h3 className="display text-lg font-bold mb-2">Avg completion time</h3>
          <p className="text-3xl font-bold">{Math.round(a.avgCompletionMs / 1000)}s</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase font-semibold text-probe-700">{label}</div>
      <div className="display text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}
