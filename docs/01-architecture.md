# Architecture

This starter uses a 3-layer architecture:

1. React UI (Vite bundle)
2. Splunk Web controller proxy (optional but recommended)
3. Splunk persistent REST handler (splunkd)

## Request paths

Primary UI path (recommended):

- `/en-US/custom/<appId>/terminal_rest_proxy/services/<appId>/terminal/<endpoint>`

Fallback paths (kept for portability):

- `/en-US/splunkd/__raw/servicesNS/nobody/<appId>/terminal/<endpoint>`
- `/en-US/splunkd/__raw/services/<appId>/terminal/<endpoint>`

## Why this pattern

- Custom controller gives stable browser auth/session handling through Splunk Web.
- Persistent REST in splunkd keeps backend logic and capability checks centralized.
- Client fallback protects you from environment-specific path quirks.
