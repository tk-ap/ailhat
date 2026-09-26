import {
  PRODUCT_SURFACES,
  PRODUCT_SURFACE_LABELS,
  type ProductOperatingProfile,
  type ProductSurface,
} from "~/lib/product-profile";

export default function ProductProfileFields({
  value,
  onChange,
}: {
  value: ProductOperatingProfile;
  onChange: (next: ProductOperatingProfile) => void;
}) {
  const input =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

  const patch = (next: Partial<ProductOperatingProfile>) =>
    onChange({ ...value, ...next });

  const surfaces = value.relevantSurfaces ?? [];
  const toggleSurface = (surface: ProductSurface) => {
    const next = surfaces.includes(surface)
      ? surfaces.filter((candidate) => candidate !== surface)
      : [...surfaces, surface];
    patch({ relevantSurfaces: next });
  };

  return (
    <fieldset className="space-y-3 rounded-xl border border-gray-800 bg-gray-950/30 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Operating profile
      </legend>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-gray-500">
          Product type
          <select
            value={value.kind}
            onChange={(event) => patch({ kind: event.target.value as ProductOperatingProfile["kind"] })}
            className={input + " mt-1"}
          >
            <option value="saas">SaaS / app</option>
            <option value="publication">Publication</option>
            <option value="api">API / developer tool</option>
            <option value="internal-tool">Internal tool</option>
            <option value="service">Service</option>
            <option value="portfolio">Portfolio / personal site</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="block text-xs font-medium text-gray-500">
          Primary outcome
          <select
            value={value.primaryOutcome}
            onChange={(event) => patch({ primaryOutcome: event.target.value as ProductOperatingProfile["primaryOutcome"] })}
            className={input + " mt-1"}
          >
            <option value="conversion">Signup / purchase / contact</option>
            <option value="content">Read / subscribe / audience</option>
            <option value="documentation">Documentation / API use</option>
            <option value="workflow">Operate a workflow</option>
            <option value="none">No conversion goal</option>
            <option value="unknown">Not sure yet</option>
          </select>
        </label>
      </div>

      <label className="block text-xs font-medium text-gray-500">
        Purpose
        <textarea
          value={value.purpose ?? ""}
          onChange={(event) => patch({ purpose: event.target.value })}
          rows={2}
          className={input + " mt-1"}
          placeholder="What is this product actually for?"
        />
      </label>

      <label className="block text-xs font-medium text-gray-500">
        Audience
        <input
          value={value.audience ?? ""}
          onChange={(event) => patch({ audience: event.target.value })}
          className={input + " mt-1"}
          placeholder="Who should get value from it?"
        />
      </label>

      <label className="block text-xs font-medium text-gray-500">
        Primary journey / desired action
        <textarea
          value={value.primaryJourney ?? ""}
          onChange={(event) => patch({ primaryJourney: event.target.value })}
          rows={2}
          className={input + " mt-1"}
          placeholder="e.g. Understand → configure → run → verify"
        />
      </label>

      <div>
        <p className="text-xs font-medium text-gray-500">Relevant surfaces</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_SURFACES.map((surface) => (
            <label
              key={surface}
              className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/60 px-2.5 py-2 text-xs text-gray-400"
            >
              <input
                type="checkbox"
                checked={surfaces.includes(surface)}
                onChange={() => toggleSurface(surface)}
              />
              {PRODUCT_SURFACE_LABELS[surface]}
            </label>
          ))}
        </div>
      </div>

      <label className="block text-xs font-medium text-gray-500">
        Explicit non-goals
        <textarea
          value={(value.nonGoals ?? []).join("\n")}
          onChange={(event) =>
            patch({
              nonGoals: event.target.value
                .split(/\r?\n/)
                .map((entry) => entry.trim())
                .filter(Boolean),
            })
          }
          rows={3}
          className={input + " mt-1"}
          placeholder={"One per line\ne.g. Public self-serve signup\ne.g. SaaS pricing funnel"}
        />
      </label>

      <p className="text-[11px] leading-5 text-gray-600">
        Profile context changes how ailhat ranks findings. It never deletes or resolves the underlying scan evidence.
      </p>
    </fieldset>
  );
}
