# Rapid Prototype Checklist

- [ ] Run `npm run template:rename -- --appId <id> --appLabel "<label>"`
- [ ] Replace `src/App.tsx` with your domain UI
- [ ] Replace backend logic in `bin/terminal_access.py`
- [ ] Keep route/controller config patterns unless you have a tested alternative
- [ ] Add capability requirements in `default/authorize.conf`
- [ ] Add app-specific conf stanzas under `default/*.conf`
- [ ] Build and package
- [ ] Install tarball and restart Splunk
- [ ] Validate controller ping and UI data flow
