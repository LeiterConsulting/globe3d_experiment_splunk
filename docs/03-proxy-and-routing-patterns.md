# Proxy + Routing Patterns

## Persistent REST (`restmap.conf`)

- Use explicit endpoint matches for critical paths.
- Keep `script`, `handler`, `handlertype`, `scripttype`, `requireAuthentication` set.

## Web exposure (`web.conf`)

Expose both controller spellings for compatibility:

- `terminal_rest_proxy/*`
- `terminalrestproxy/*`

Also expose app-scoped service patterns where needed.

## Controller proxy (`appserver/controllers`)

- Read session key from CherryPy session.
- Proxy only allowlisted paths for your app ID.
- Forward method + params/body to `splunk.rest.simpleRequest`.

## Frontend fallback

The client should try controller proxy first, then `__raw/servicesNS` and `__raw/services` patterns.

This improves portability across Splunk versions/environments.
