import React from "react";
import { ButtonFieldProps } from "../ts-linked/Button.types";
import { fallbackFooterText } from "../ts-linked/FormSection.utils";

type FormSectionProps = {
  title: string;
  description: string;
  fields: ButtonFieldProps[];
  footerText?: string;
};

export function FormSection({ title, description, fields, footerText }: FormSectionProps) {
  return (
    <section className="grid gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <header className="grid gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.id} className="grid gap-2 text-sm text-slate-700">
            <span className="font-medium text-slate-800">{field.label}</span>
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={field.placeholder}
            />
          </label>
        ))}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>{fallbackFooterText(footerText)}</span>
        <button className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 font-medium text-white">
          Continue
        </button>
      </footer>
    </section>
  );
}
