import React from "react";

export function SimpleWidget({ title, items = [], isActive = false, onSelect }) {
  return (
    <section className="rounded-lg border p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {isActive ? <span className="text-xs text-emerald-600">Active</span> : <span className="text-xs text-slate-500">Paused</span>}
      </header>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <button className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left" onClick={() => onSelect?.(item.id)}>
              <span>{item.label}</span>
              {item.pending && <span className="text-xs text-amber-600">Pending</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
