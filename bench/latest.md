# Live Team benchmark

Run: 2026-11-08T19:06:46.441Z · endpoint: http://127.0.0.1:5180
Live snapshot before: 24 conversations, 65 messages, usage 27/50
Live snapshot after: 25 conversations, 66 messages, usage 27/50

| Task | Area | Mode | Verdict | Latency | Drafters | Referee | Verifier | Repaired |
|---|---|---|---:|---:|---|---|---|---:|
| R1 | research | Best single (nvidia/nemotron-3-super-120b) | manual | 14.5s | — | — | — | no |
| R2 | research | Best single (nvidia/nemotron-3-super-120b) | manual | 16.0s | — | — | — | no |
| R1 | research | Legacy single (command-a-plus-05-2026) | manual | 43.4s | — | — | — | no |
| R2 | research | Legacy single (command-a-plus-05-2026) | manual | 16.6s | — | — | — | no |

## Summary

| Mode | Auto-scored | Passed | Failed | Manual | Pass rate | Avg latency | Slow | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Best single (nvidia/nemotron-3-super-120b) | 0 | 0 | 0 | 2 | —% | 15.3s | 0 | 0 |
| Legacy single (command-a-plus-05-2026) | 0 | 0 | 0 | 2 | —% | 30.0s | 0 | 0 |
