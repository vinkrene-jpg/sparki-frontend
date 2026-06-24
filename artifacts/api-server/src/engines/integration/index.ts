// Integration engine.
//
// Owns the connector registry (which platforms exist, what each can provide, and
// whether it is wireable today) and the per-provider sync implementations.
// Consumed by the connectors route.
//
// Design decision: third-party data is imported via PER-USER OAuth — tokens are
// stored per athlete in `connector_connections` — NOT the account-level Replit
// connector proxy, which would leak one bound account's data to every user. See
// docs/engine-architecture.md.

// Connector catalog / capability registry.
export * from "../../lib/connectors/registry";

// Provider sync implementations.
export * from "../../lib/connectors/providers/strava";

// Per-user OAuth surface (authorize/exchange/refresh/state, config checks).
export * from "../../lib/connectors/providers/strava-oauth";

// Data Hub — central normalization / ingest / dedup / consent / readiness /
// logging engine that every platform funnels through.
export * from "../data-hub";
