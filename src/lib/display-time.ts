import { useEffect, useState } from "react";

/** Locale-independent date text for SSR and browser parity. */
export function displayDate(value: string | number): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toISOString().slice(0, 10);
}

/** Returns null during the shared render, then a live clock after hydration. */
export function useClientNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  return now;
}
