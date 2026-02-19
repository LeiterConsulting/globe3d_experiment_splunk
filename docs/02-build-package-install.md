# Build, Package, Install

## Build and package

```bash
npm install
npm run build:splunk
npm run package:splunk
```

Output package:

- `build/<appId>.tar.gz` (default: `build/splunk_terminal_app.tar.gz`)

## Install in Splunk

1. Upload/install tarball in Splunk Apps UI.
2. Restart Splunk.
3. Open app view and verify panel loads.

## Validation commands (server-side)

```bash
splunk cmd btool restmap list --debug | egrep "terminal_access|<appId>"
splunk cmd btool web list --debug | egrep "terminal_rest_proxy|<appId>"
```
