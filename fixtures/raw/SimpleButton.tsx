import React from "react";
import type { ButtonVariant } from "./Button.types";

type SimpleButtonProps = {
  label: string;
  variant?: ButtonVariant;
};

export function SimpleButton({ label, variant = "primary" }: SimpleButtonProps) {
  return <button className="px-3 py-2 rounded">{variant === "secondary" ? `${label} (secondary)` : label}</button>;
}
