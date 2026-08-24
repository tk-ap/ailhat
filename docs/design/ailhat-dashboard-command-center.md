# Ailhat Dashboard — Command Center UI Direction

## Purpose
Redesign the authenticated Ailhat user dashboard so the first question answered is:

> **What should I do next?**

The dashboard should feel like a premium dark command center, not a generic project-management dashboard or analytics dashboard.

## Source visual
A visual concept was generated for this direction in the ChatGPT conversation. When implementing in CTO.new, use the user's uploaded visual as the visual reference and preserve the current Ailhat product identity.

## Core hierarchy
1. TODAY
2. What should I do next?
3. Ranked attention items
4. Evidence + why it matters
5. One obvious recommended action
6. Feedback controls

## Attention categories
Use these as the primary semantic states:
- ACT NOW — urgent/high-impact issue
- REVIEW — issue requiring user review
- OPPORTUNITY — actionable growth/product opportunity
- HEALTHY — no action needed / positive signal

Do not use generic PM labels such as Upcoming Work, Tasks, or To Do as the primary dashboard hierarchy.

## Attention item anatomy
Every item should communicate, without requiring a detail-page visit:
- WHAT happened / what Ailhat detected
- WHY IT MATTERS
- EVIDENCE
- CONFIDENCE
- RECOMMENDED NEXT ACTION
- FEEDBACK

Recommended actions include:
- Investigate
- Fix
- Review
- Explore
- Create task
- Snooze
- Dismiss
- Mark incorrect

## Visual direction
- Premium dark command-center aesthetic
- High information density without visual clutter
- Linear-like restraint in typography, spacing, hierarchy, and subtle borders
- ClickUp-like navigational density where useful
- Distinctly Ailhat; do not clone either product
- Avoid large white cards / white boxes on the dark dashboard
- Use dark surfaces with subtle elevation/borders and restrained semantic accents
- Use color primarily to communicate state/severity, not decoration
- Strong typography and spacing hierarchy
- Dense rows/cards are preferred over oversized decorative cards
- Evidence can expand inline rather than forcing navigation

## Suggested dashboard structure

SIDEBAR
- Today
  - Signals
  - Portfolio
- Intelligence
  - Opportunities
  - Risks
  - Trends
- Products
  - Product list
- Connections
- Settings

MAIN
- TODAY
- Subtitle: What should I do next?
- Summary counts: Act Now / Review / Opportunities / Healthy
- Your top attention — ranked by impact, confidence, and recency
- Attention items with direct actions

RIGHT RAIL
- Portfolio overview
- Scan status
- Recent activity
- How Ailhat works / intelligence pipeline

## Important product principle
Ailhat does not give users more work. It tells them which work deserves attention.

The fundamental unit is **attention**, not tasks.

## Intelligence pipeline
PRODUCT → OBSERVE → SCAN/INGEST → NORMALIZE → CLASSIFY → COMPARE → PRIORITIZE → RECOMMEND → ACTION → FEEDBACK

## Phase 1 UX requirements
The dashboard must support the upcoming automatic-observation model:
- Dashboard refresh triggers a non-blocking observation/scan
- Each product shows Live / Updating / Unavailable + Retry
- Scan history is discoverable
- Findings are deduplicated and show occurrence counts
- Findings show NEW / RESOLVED / PERSISTING / REGRESSED state where applicable
- Evidence and confidence are visible
- Every finding leads to an action or feedback path

## Brand constraint
Canonical product identity is **Ailhat**. "Sortie" is retired and must never appear in visible UI copy, navigation, titles, metadata, empty states, or onboarding.

## Implementation constraint
Do not replace the current working CTO.new application with a speculative rebuild. Treat this document and the supplied visual as the target UX direction. Preserve existing functionality while replacing the confusing white-box upcoming-work presentation with the attention-first command-center hierarchy.
