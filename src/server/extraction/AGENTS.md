# AGENTS.md · src/server/extraction

The prompt, the model and the reasoning effort a reader uses are not chosen in this folder. They are decided in [`docs/extraction.md`](../../../docs/extraction.md), and every decision there rests on an experiment under [`experiments/module-01-extraction/`](../../../experiments/module-01-extraction/). To change any of the three: run an experiment, add an entry to `docs/extraction.md` that cites its report, then change the code here to match. Not the other way round. A value in this folder that `docs/extraction.md` does not name is a value nobody measured.

`provider.ts` is the interface every reader implements, and `mock-provider.ts` is the worked example. Whatever a real provider returns is validated against the contract in `src/lib/contract/extraction.ts` before it goes anywhere; a provider is never trusted.
