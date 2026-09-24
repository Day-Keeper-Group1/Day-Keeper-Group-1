import json
from pathlib import Path

from PIL import Image, ImageDraw
import numpy as np
from rapidocr_onnxruntime import RapidOCR

NEW_PAGE = r"D:\Learning\RMIT\02-IT_Project-COSC2648\08-DayKeeper工作文档\合成数据管线\letters-future-dates\data\synthetic-letters\01-electricity-bill\page-01.png"
OUT_DIR = Path(r"D:\Learning\RMIT\02-IT_Project-COSC2648\08-DayKeeper工作文档\讲解脚本\2026-09-24-课堂演示\assets\ocr")

# Crop box for the payment panel, measured by template-matching the reference
# payment-panel.png against the OLD page-01.png (exact pixel match at this
# offset), then confirmed the SAME offset matches the NEW page-01.png too
# (the "How to pay" panel is pixel-identical between old and new bills).
CROP_X0, CROP_Y0 = 130, 2020
CROP_W, CROP_H = 2230, 680
CROP_X1, CROP_Y1 = CROP_X0 + CROP_W, CROP_Y0 + CROP_H

# Five equal payment-method columns inside the panel (measured: panel width
# 2230 / 5 = 446 each), in PAGE-ABSOLUTE x coordinates.
COL_WIDTH = CROP_W / 5
COL_BOUNDS = {
    "dd": (CROP_X0 + 0 * COL_WIDTH, CROP_X0 + 1 * COL_WIDTH),
    "bank": (CROP_X0 + 1 * COL_WIDTH, CROP_X0 + 2 * COL_WIDTH),
    "card": (CROP_X0 + 2 * COL_WIDTH, CROP_X0 + 3 * COL_WIDTH),
    "post": (CROP_X0 + 3 * COL_WIDTH, CROP_X0 + 4 * COL_WIDTH),
    "pay": (CROP_X0 + 4 * COL_WIDTH, CROP_X0 + 5 * COL_WIDTH),
}
# Row where the DD/BANK/CARD/POST/PAY pill labels start (page-absolute y).
# Anything above this inside the crop is the panel header, not a column.
COLUMN_ROW_START_Y = 2150

# Tint boxes, measured directly off the reference payment-panel.png (local
# to the crop, i.e. relative to CROP_X0/CROP_Y0). Both boxes are 420 px wide
# and share the same vertical extent.
YELLOW_BOX_LOCAL = (448, 132, 868, 465)  # x0, y0, x1, y1
GREEN_BOX_LOCAL = (1328, 132, 1748, 465)
YELLOW_HEX = (0xFB, 0xE2, 0x7A)
GREEN_HEX = (0xA7, 0xEE, 0xBF)
CORNER_RADIUS = 24

RED = (0xC0, 0x39, 0x2B)
RED_STROKE = 8


def run_ocr():
    engine = RapidOCR()
    result, _elapse = engine(NEW_PAGE)
    out = []
    for box, text, score in result:
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        out.append(
            {
                "text": text,
                "score": round(float(score), 3),
                "x": round(min(xs)),
                "y": round(min(ys)),
            }
        )
    print("BOXES", len(out))
    (OUT_DIR / "ocr-raw.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    flat = " ".join(o["text"] for o in out)
    (OUT_DIR / "ocr-flat.txt").write_text(flat, encoding="utf-8")
    return out


def make_payment_panel():
    page = Image.open(NEW_PAGE).convert("RGB")
    crop = page.crop((CROP_X0, CROP_Y0, CROP_X1, CROP_Y1))
    arr = np.array(crop).astype(float)

    def tint_box(box, hex_color):
        # The reference panel tints the empty (near-white) background of a
        # column but leaves existing dark content (text, pill borders, the
        # solid BANK pill fill) essentially untouched - consistent with the
        # tint being a CSS background-color sitting BEHIND the card content,
        # not a flat overlay painted on top of the finished screenshot.
        # We reproduce that look by blending white->tint fully, unchanged
        # content not at all, and a smooth ramp in between (so anti-aliased
        # text edges don't get a hard fringe).
        x0, y0, x1, y1 = box
        mask_img = Image.new("L", (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(mask_img).rounded_rectangle(
            [0, 0, x1 - x0 - 1, y1 - y0 - 1], radius=CORNER_RADIUS, fill=255
        )
        box_mask = np.array(mask_img).astype(float) / 255.0

        region = arr[y0:y1, x0:x1]
        brightness = region.min(axis=2)  # near 255 = plain white background
        whiteness = np.clip((brightness - 200.0) / (250.0 - 200.0), 0.0, 1.0)
        alpha = whiteness * box_mask

        tint = np.array(hex_color, dtype=float)
        blended = region * (1 - alpha[..., None]) + tint * (alpha[..., None])
        arr[y0:y1, x0:x1] = blended

    tint_box(YELLOW_BOX_LOCAL, YELLOW_HEX)
    tint_box(GREEN_BOX_LOCAL, GREEN_HEX)

    out_img = Image.fromarray(arr.clip(0, 255).astype("uint8"), "RGB")
    out_img.save(OUT_DIR / "payment-panel.png")


def make_marked_letter():
    page = Image.open(NEW_PAGE).convert("RGB")
    draw = ImageDraw.Draw(page)
    half = RED_STROKE / 2
    draw.rectangle(
        [
            CROP_X0 - half,
            CROP_Y0 - half,
            CROP_X1 + half,
            CROP_Y1 + half,
        ],
        outline=RED,
        width=RED_STROKE,
    )
    page.save(OUT_DIR / "letter-01-page-01.png")


def column_for(x):
    for name, (x0, x1) in COL_BOUNDS.items():
        if x0 <= x < x1:
            return name
    return "other"


def make_panel_lines(ocr_boxes):
    lines = []
    for box in ocr_boxes:
        x, y = box["x"], box["y"]
        if not (CROP_X0 <= x < CROP_X1 and CROP_Y0 <= y < CROP_Y1):
            continue
        if y < COLUMN_ROW_START_Y:
            col = "other"
        else:
            col = column_for(x)
        lines.append(
            {
                "text": box["text"],
                "column": col,
                "x": x,
                "y": y,
                "score": box["score"],
            }
        )

    (OUT_DIR / "ocr-panel-lines.json").write_text(
        json.dumps(lines, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    with open(OUT_DIR / "ocr-panel.txt", "w", encoding="utf-8") as f:
        for line in lines:
            f.write(f"[{line['column']}] {line['text']}\n")
    return lines


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ocr_boxes = run_ocr()
    make_payment_panel()
    make_marked_letter()
    lines = make_panel_lines(ocr_boxes)
    print("PANEL LINES", len(lines))


if __name__ == "__main__":
    main()
