import React, { useEffect, useMemo, useState } from "react";

type DashboardPanelProps = {
  userName: string;
  alerts: Array<{ id: string; severity: "info" | "warning" | "critical"; message: string }>;
  loading?: boolean;
};

export default function DashboardPanel({ userName, alerts, loading = false }: DashboardPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<"all" | "info" | "warning" | "critical">("all");
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([]);

  useEffect(() => {
    if (alerts.some((alert) => alert.severity === "critical")) {
      setExpanded(true);
    }
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    if (selectedSeverity === "all") {
      return alerts;
    }
    return alerts.filter((alert) => alert.severity === selectedSeverity);
  }, [alerts, selectedSeverity]);

  const handleSeverityChange = (severity: "all" | "info" | "warning" | "critical") => {
    setSelectedSeverity(severity);
  };

  const handleAcknowledge = (id: string) => {
    setAcknowledgedIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const toneClassName = expanded ? "border-red-300 bg-red-50" : "border-slate-200 bg-white";

  if (loading) {
    return (
      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">Loading dashboard activity…</p>
      </section>
    );
  }

  return (
    <section className={`grid gap-5 rounded-xl border p-6 shadow-sm transition ${toneClassName}`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Dashboard</span>
          <h2 className="text-xl font-semibold text-slate-900">Welcome back, {userName}</h2>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "info", "warning", "critical"] as const).map((severity) => (
            <button
              key={severity}
              className={selectedSeverity === severity ? "rounded-full bg-slate-900 px-3 py-1 text-white" : "rounded-full border border-slate-200 px-3 py-1 text-slate-600"}
              onClick={() => handleSeverityChange(severity)}
            >
              {severity}
            </button>
          ))}
          <button className="rounded-full border border-slate-300 px-3 py-1 text-slate-600" onClick={() => setExpanded((current) => !current)}>
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </header>

      {filteredAlerts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          No alerts for the selected severity.
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredAlerts.map((alert) => (
            <article
              key={alert.id}
              className={alert.severity === "critical" ? "grid gap-3 rounded-lg border border-red-200 bg-red-50 p-4" : "grid gap-3 rounded-lg border border-slate-200 bg-white p-4"}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{alert.severity}</span>
                  <p className="text-sm text-slate-700">{alert.message}</p>
                </div>
                {acknowledgedIds.includes(alert.id) ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Acknowledged</span>
                ) : (
                  <button className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white" onClick={() => handleAcknowledge(alert.id)}>
                    Acknowledge
                  </button>
                )}
              </div>
              {expanded && alert.severity !== "info" && (
                <div className="rounded-md bg-slate-950/5 px-3 py-2 text-xs text-slate-500">
                  Expanded operational guidance is visible for higher-severity alerts.
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
