const state = {
  schema_version: "1.0",
  product: {
    id: "ailhat",
    name: "Ailhat",
    state: "ACTIVE",
    launch_stage: "PRIVATE_BETA_PRE_LAUNCH",
    readiness_score: 65,
    readiness_confidence: "MEDIUM",
    distance_to_first_paid_client: "~4–8 meaningful work sessions",
    attention_status: "NEEDS_ATTENTION",
    neglect_risk: "MEDIUM"
  },
  scan: {
    status: "OWNER_DASHBOARD_SOURCE",
    observed_at: null,
    source: "ailhat_owner_dashboard",
    live_scan_available: true,
    note: "This endpoint is the integration contract. Populate observed_at and findings from the owner-dashboard live-scan persistence layer when that runtime source is wired."
  },
  health: {
    broken_links: null,
    missing_meta: null,
    missing_og: null,
    missing_favicon: null,
    missing_description: null,
    missing_robots: null,
    missing_sitemap: null,
    https_issues: null,
    error_count: null
  },
  attention: {
    top_issue: "production reliability/auth",
    priority: "P0",
    top_next_action: "Restore production reliability/auth and validate the complete live scan loop"
  },
  work: [
    {
      title: "Restore production reliability + auth",
      priority: "P0",
      estimated_minutes: 90,
      suggested_execution_mode: "coding-agent",
      expected_product_impact: "HIGH",
      source: "portfolio_context_seed"
    },
    {
      title: "Run complete live scan",
      priority: "P0",
      estimated_minutes: 30,
      suggested_execution_mode: "coding-agent",
      expected_product_impact: "HIGH",
      source: "portfolio_context_seed"
    },
    {
      title: "Convert market gaps into agent-ready work",
      priority: "P1",
      estimated_minutes: 60,
      suggested_execution_mode: "coding-agent",
      expected_product_impact: "HIGH",
      source: "portfolio_context_seed"
    }
  ],
  provenance: {
    source_type: "conversation_seed_plus_owner_dashboard_contract",
    source_ref: "tk-ap/ailhat/docs/PORTFOLIO_AND_AGENT_CONTROL.md"
  }
};

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(200).json({ ok: true, ...state });
}
