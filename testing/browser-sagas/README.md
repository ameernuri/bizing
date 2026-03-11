# Browser Sagas (UC1-UC10)

Saved browser saga definitions live in:

- `testing/browser-sagas/definitions/uc-1-to-10.browser.json`

Run a saga with Playwright (headed by default):

```bash
bun run --cwd apps/api sagas:browser           # defaults to UC_ID=1
UC_ID=2 bun run --cwd apps/api sagas:browser   # run a specific UC
```

Run artifacts are written to:

- `/tmp/browser-saga-uc<id>-<stamp>/` (screenshots + `run-manifest.json`)
- `testing/browser-sagas/runs/*.json` (manifest history tracked in repo)

Each run validates:

- guest redirect to `/login`
- customer denied access to `/dev/lab`
- owner dashboard setup flow
- customer booking creation + payment intent attempt
- owner communications visibility
- owner report render
