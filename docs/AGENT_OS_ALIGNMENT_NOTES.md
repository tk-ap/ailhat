# Agent OS alignment notes

This branch supersedes the older Agent OS alignment PR by rebuilding from current `main` after the evidence architecture changes.

Key rules preserved:

- ailhat remains Portfolio Intelligence.
- Agent Direct is the user-facing handoff into governed action, not an authorization or execution engine.
- Agent OS / Workforce owns task-first workforce composition and execution policy.
- Agent Control remains an internal authorization-intelligence layer in the Agent OS control plane where integrated; it is not revived as a separate public ailhat offering.
- Production, repository, deployment, ailhat history, and market evidence retain distinct provenance and authority scopes.
- Portable work items transfer intent and evidence but never grant execution authority.
