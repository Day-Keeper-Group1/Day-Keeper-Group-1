# Extraction: the model in use

What the reading step calls, and why. Newest decision on top. Each entry says what was chosen, which experiment report it rests on, and whether it is settled.

The code in `src/server/extraction/` follows this file, not the other way round. To change the prompt, the model or the effort there: run an experiment under `experiments/module-01-extraction/`, add an entry here that cites its report, then change the code to match.

## 2026-09-09 · gpt-5.6-luna at medium, provisional

**Model** `gpt-5.6-luna`. **Effort** `medium`. **Prompt** as in [`experiments/module-01-extraction/01-full-grid/prompt.md`](../experiments/module-01-extraction/01-full-grid/prompt.md).

**Basis** [01-full-grid/REPORT.md](../experiments/module-01-extraction/01-full-grid/REPORT.md). On the fifteen letters in scope, four cells scored full marks: luna `medium`, luna `xhigh`, terra `low`, terra `xhigh`. luna `medium` is the cheapest of the four at about A$0.008 a letter, against A$0.069 for terra `low`.

**Status: provisional.** The report's own verdict is that one read per cell cannot show stability: the full cells are separated from their neighbours by one or two letters, and effort does not order them. This choice is made so the reading step can be built now rather than after the next experiment. Experiment 02 will read the four full cells repeatedly. If luna `medium` holds, this entry is confirmed; if it does not, the entry above this one will say what replaced it.
