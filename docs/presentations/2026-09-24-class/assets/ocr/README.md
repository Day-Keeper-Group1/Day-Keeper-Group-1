## What this folder is

Reproduction of the OCR-vs-voting comparison asset used in the 2026-09-16 Golnoush
walkthrough (`08-DayKeeper工作文档/讲解脚本/2026-09-16-Golnoush周会/assets/`), run
against the NEW version of letter 01 (electricity bill) where the pay-by date and
amount changed to 02/11/2026 and $81.29. Source image:

`08-DayKeeper工作文档/合成数据管线/letters-future-dates/data/synthetic-letters/01-electricity-bill/page-01.png`

Build script: `build_assets.py`, included in this folder. Re-run with
`uv run --with rapidocr-onnxruntime --with pillow --with numpy python build_assets.py`
to regenerate everything below. RapidOCR (`rapidocr-onnxruntime`) is the OCR
engine, same as the 09-16 reference.

## Files

- `ocr-raw.json`: every OCR box RapidOCR found on the full page: text, confidence
  score, and the box's top-left x/y in page pixel coordinates. **102 boxes.**
- `ocr-flat.txt`: the same 102 boxes' text, space-joined into one line in the
  engine's own reading order. Matches the method of the reference `run_ocr.py`
  exactly (that script also writes one space-joined line, not one line per box).
- `payment-panel.png`: crop of the "How to pay" panel from the new page, with
  the BANK column tinted yellow and the POST column tinted green, same as the
  09-16 reference asset.
- `ocr-panel-lines.json`: the 40 OCR lines that fall inside the payment-panel
  crop, in the engine's reading order, each tagged with `column`
  (`dd`/`bank`/`card`/`post`/`pay`/`other`) plus its `x`/`y`/`score`.
- `ocr-panel.txt`: same 40 lines as plain text, one per line, prefixed
  `[column] text`.
- `letter-01-page-01.png`: full new page with one red rectangle drawn around
  the whole payment panel (stroke 8px, colour `#c0392b`), same style as the
  reference `letter-01-electricity-bill.png`.

## Crop box and column ranges actually used

The reference `payment-panel.png` was template-matched (OpenCV `matchTemplate`,
`TM_SQDIFF`) against the OLD `page-01.png` to find the exact crop it came from,
then the same offset was checked against the NEW `page-01.png` and gave an
almost pixel-identical match (mean squared diff 0.03 per pixel, i.e. only PNG
recompression noise). So the "How to pay" panel sits at the exact same spot on
both bills, and this is what was used:

- **Crop box (page-absolute pixels):** x 130 to 2360, y 2020 to 2700
  (width 2230, height 680).
- **Five payment-method columns**, panel width split into five equal 446px
  columns, page-absolute x ranges:
  - `dd`: 130 to 576
  - `bank`: 576 to 1022
  - `card`: 1022 to 1468
  - `post`: 1468 to 1914
  - `pay`: 1914 to 2360
- **Header vs column split:** any OCR box with y below 2150 (page-absolute,
  inside the crop) is the panel header ("How to pay" title and the "Example
  Energy Pty Ltd ABN ..." line) and is tagged `other`, not a column. The column
  labels (DD/BANK/CARD/POST/PAY) start at y about 2170.
- **Tint boxes** (measured directly off the reference `payment-panel.png`,
  panel-local coordinates, i.e. relative to the crop's own top-left corner):
  - yellow (BANK): x 448 to 868, y 132 to 465
  - green (POST): x 1328 to 1748, y 132 to 465
  - both are 420px wide, same height, rounded corners (radius about 24px).
- **Tint colours:** `#fbe27a` (yellow, BANK) and `#a7eebf` (green, POST), same
  hex values as `mark.c-bank` / `mark.c-post` in the reference `index.html`.
  These are applied as a background fill behind the existing panel content
  (only near-white background pixels get tinted; existing dark text, borders,
  and the solid BANK pill keep their original colour), which is how the
  reference asset actually looks: the BANK pill and all body text stay fully
  dark inside both tinted columns rather than being washed out by a flat
  overlay.

## OCR box count

**102 boxes** on the full page. **40 of those 102** fall inside the payment
panel crop and are the ones tagged in `ocr-panel-lines.json` / `ocr-panel.txt`.
