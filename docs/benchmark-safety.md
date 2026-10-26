# Benchmark request bounds

Before a run, verify the current Meta credit balance and current official rates. This check was performed October 26, 2026, and available free credits exceeded the conservative generation estimate below. Private account/payment details are not included here; billing can lag up to an hour.

The initial uncapped batch was rejected by automatic approval review because credits could be exhausted and the linked card charged. No paid batch was started by that rejected command.

The revised client enforces these limits before inference:

- Only `muse-spark-1.3` is accepted.
- Every request is first sent to `/v1/responses/input_tokens`; malformed/failed counts stop that request.
- Inputs above 64,000 counted tokens are rejected before inference.
- Output generation is limited to 2,048 tokens per call, including reasoning.
- Only local function tools are offered; no hosted web-search or other paid tools.
- The batch has exactly 25 scheduled jobs, at most 25 inference attempts per job, no retries, and at most two simultaneous jobs.
- An oversized-input or other failure remains visible in the results; it is not silently retried with a larger limit.

Official standard pricing checked October 26, 2026: $1.25 per million uncached input tokens and $4.25 per million output tokens. Ignoring cache savings, 625 requests at these input/output limits correspond to $55.44 of token-priced generation. This is a conservative planning calculation based on a single model iteration with no hosted tools, not a provider-enforced dollar spending cap or a guarantee against unrelated usage of the account. The client also stops scheduling after 25 million returned tokens; already running jobs may finish.

Token counting itself tokenizes and validates input; it does not generate output or record generation usage. Meta notes that token counting measures context rather than cumulative billing, especially when hosted tools create more iterations. We do not use hosted tools in this benchmark.

Sources: [Meta pricing](https://dev.meta.ai/docs/pricing-rate-limits), [token counting](https://dev.meta.ai/docs/token-counting), [Muse Spark pricing](https://dev.meta.ai/models/muse-spark).
