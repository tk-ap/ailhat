export interface WorkflowStep {
  id: "landing" | "workspace" | "intelligence" | "product" | "direct" | "verify";
  label: string;
  href: string;
}

export function workflowSteps(productId?: string): WorkflowStep[] {
  const productHref = productId ? "/product/" + encodeURIComponent(productId) : "/portfolio";
  return [
    { id: "landing", label: "Landing", href: "/" },
    { id: "workspace", label: "Workspace", href: "/dashboard" },
    { id: "intelligence", label: "Intelligence", href: "/brief" },
    { id: "product", label: "Product Cockpit", href: productHref },
    { id: "direct", label: "Direct", href: "/control" },
    { id: "verify", label: "Verify", href: productId ? productHref + "#verify" : "/brief" },
  ];
}

export default function WorkflowPath({
  productId,
  productName,
  compact = false,
}: {
  productId?: string;
  productName?: string;
  compact?: boolean;
}) {
  const steps = workflowSteps(productId);
  return (
    <nav aria-label="ailhat operating workflow" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden className="text-gray-700">→</span>}
            <a
              href={step.href}
              data-workflow-step={step.id}
              className={
                compact
                  ? "font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-500 hover:text-[#7fb0ff]"
                  : "rounded-full border border-gray-800 bg-gray-950/70 px-3 py-1.5 font-mono text-[11px] font-semibold text-gray-400 hover:border-[#7fb0ff]/40 hover:text-[#7fb0ff]"
              }
              title={step.id === "product" && productName ? "Product Cockpit · " + productName : step.label}
            >
              {step.id === "product" && productName ? step.label + " · " + productName : step.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
