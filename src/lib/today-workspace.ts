export interface TodayPreference {
  collapsed: boolean;
  order: number;
  // Position to restore when a condensed product is expanded again. Optional so
  // previously-persisted v1 preferences remain valid without migration.
  restoreOrder?: number;
}

export type TodayPreferences = Record<string, TodayPreference>;

export const TODAY_WORKSPACE_KEY = "ailhat.today-workspace.v1";

export function loadTodayPreferences(): TodayPreferences {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TODAY_WORKSPACE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as TodayPreferences)
      : {};
  } catch {
    return {};
  }
}

export function saveTodayPreferences(value: TodayPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TODAY_WORKSPACE_KEY, JSON.stringify(value));
  } catch {
    // Presentation state only; never block portfolio state.
  }
}

export function orderedProductIds(
  products: Array<{ id: string }>,
  preferences: TodayPreferences,
): string[] {
  return [...products]
    .sort((a, b) => {
      const ai = products.findIndex((p) => p.id === a.id);
      const bi = products.findIndex((p) => p.id === b.id);
      return (preferences[a.id]?.order ?? ai) - (preferences[b.id]?.order ?? bi);
    })
    .map((product) => product.id);
}
