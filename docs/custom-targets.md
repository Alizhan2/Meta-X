# Custom website tasks

Choose **Your website** in the workbench, enter an HTTP or HTTPS URL and a task, then start the agent. The URL is limited to 2,048 characters and the task to 2,000 characters. URL fragments are retained for client-side routes. Printable multilingual text can be typed into the currently focused control, up to 256 characters per action.

The browser is fresh: it does not import the user's logins, cookies or browser profile. Navigation stays on the final target origin; initial same-host `www` and HTTP→HTTPS redirects are allowed. Public CDN/API resources can load through the guarded proxy. The current worker operates in one tab, dismisses native JavaScript dialogs, and does not accept downloads.

## Outcomes and evidence

The model may declare completion with a strict terminal response. It appears as **Model reported completion**, not independently verified success. Blocked, budget-limited, failed or cancelled runs remain inconclusive. Neither outcome alone proves an accessibility defect.

Custom reports retain URL, task, focus changes, actions, screenshots, model/usage and cancellation details. They do not run booking-fixture contract probes or automatically replay real actions. A test form submission is therefore not repeated by the evidence stage.

The same 25 decision/action limit, token preflight, stop monitor, cancellation and keyboard-only executor apply. No click, selector, DOM mutation, arbitrary navigation or shell tool is exposed to the model.

## Network boundary

Public targets use a local HTTP/CONNECT proxy. DNS answers are validated and the connection uses the pinned public IP; private, metadata and reserved addresses are rejected, including mixed public/private answers and IPv4-mapped IPv6. Explicit localhost development URLs permit only their exact origin. The workbench's own control port is excluded across loopback aliases.

Chromium is configured to send loopback traffic through the proxy, with QUIC and non-proxied WebRTC UDP disabled. TLS remains end-to-end and certificate checks stay enabled. See [Chromium proxy bypass documentation](https://github.com/chromium/chromium/blob/main/net/docs/proxy.md) and [Chromium network switches](https://chromium.googlesource.com/chromium/src/+/8f718e9a/components/network_session_configurator/switches.cc). This is an HTTP(S) request boundary for the local testing tool, not a general sandbox for hostile code.

## Verification

- 42 unit tests pass, including strict custom completion parsing, fixture/custom attribution separation, multilingual input, origin escape rejection, DNS pinning and private-address cases.
- The existing fixture workbench's 13 browser/API checks still pass with zero page errors.
- `npm run check:custom` exercises the URL/task fields through the actual server and Chromium, a separate HTTP search site, Cyrillic input, an asynchronous form response, persistent validation errors, stop, history/reload and mobile layout. Scripted decisions are labelled, and no Meta API calls are made by this check.
- The search form was submitted once. The probe/replay stage did not repeat it. An attempted request to another loopback server never reached that server.
- A public HTTPS page loaded through CONNECT with normal browser certificate validation.

One live Muse Spark 1.3 run was launched from the workbench against a separate local workshop-search site with a task written in Russian. The agent used four keyboard actions and five decisions, found the requested result, and returned the strict completion message. The site recorded one search submission. The report correctly retained `agent_reported_complete`, without a fixture success oracle. Returned usage: 33,005 tokens. [Raw live record](custom-2026-10-26/live-run.json), [scripted browser check](custom-2026-10-26/browser-check.json).

This small check verifies the new flow; it is not a reliability estimate across arbitrary websites. Original fixture benchmarks remain unchanged.

A later [public-site verification](public-sites-2026-10-27/README.md) exercised real navigation and search on official Python documentation, found and fixed history growth/reasoning-continuity issues, and retained every development attempt.
