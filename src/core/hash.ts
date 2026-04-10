import crypto from "node:crypto";

export function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}
