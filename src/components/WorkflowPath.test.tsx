import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import WorkflowPath, { workflowSteps } from "./WorkflowPath";

describe("navigation workflow rendering", () => {
  test("renders the required operating path in order", () => {
    const html = renderToStaticMarkup(
      <WorkflowPath productId="ledgato" productName="LEDGATo" />,
    );
    const labels = ["Landing", "Workspace", "Intelligence", "Product Cockpit", "Direct", "Verify"];
    let last = -1;
    for (const label of labels) {
      const index = html.indexOf(label);
      expect(index).toBeGreaterThan(last);
      last = index;
    }
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/brief"');
    expect(html).toContain('href="/product/ledgato"');
    expect(html).toContain('href="/control"');
    expect(html).toContain('href="/product/ledgato#verify"');
  });

  test("generic workspace navigation falls back to the Products directory", () => {
    expect(workflowSteps().find((step) => step.id === "product")?.href).toBe("/portfolio");
  });
});
