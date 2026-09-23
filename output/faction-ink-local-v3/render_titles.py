"""Local preview of complete faction titles: 三国-魏 / 三国-蜀 / 三国-吴."""

import importlib.util
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).resolve().parent
ENGINE = OUT.parent / "faction-ink-local-v2" / "render_ink.py"
spec = importlib.util.spec_from_file_location("ink_v2", ENGINE)
ink = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ink)

FACE = ImageFont.truetype(str(ink.FONTS / "STXINGKA.TTF"), 790)
BOXES = {char: FACE.getbbox(char) for char in "三国魏蜀吴-"}
SCALE = min(
    622 / max(b[2] - b[0] for b in BOXES.values()),
    558 / max(b[3] - b[1] for b in BOXES.values()),
)
TITLE_SIZE = (1856, 704)


def glyph_mask(char):
    """A shared em scale preserves the proportions of 三国 and the hyphen."""
    b = BOXES[char]
    raw = Image.new("L", (b[2] - b[0] + 16, b[3] - b[1] + 16))
    ImageDraw.Draw(raw).text((8 - b[0], 8 - b[1]), char, font=FACE, fill=255)
    raw = raw.crop(raw.getbbox())
    raw = raw.resize((round(raw.width * SCALE), round(raw.height * SCALE)), ink.RESAMPLE)
    mask = Image.new("L", (ink.S, ink.S))
    mask.paste(raw, ((ink.S - raw.width) // 2, (ink.S - raw.height) // 2))
    return mask


# Reuse the material implementation without changing the previous version.
ink.original_glyph = glyph_mask


def title_sprite(faction, style, seed):
    result = Image.new("RGBA", TITLE_SIZE)
    for index, (char, center) in enumerate(zip("三国-" + faction["char"], (294, 748, 1116, 1507))):
        settings = dict(style)
        if char == "-":
            settings.update(clusters=3, drops=2)
        character = dict(faction, char=char)
        tile = ink.render_letter(character, settings, seed + index * 17)
        tile = tile.resize((704, 704), ink.RESAMPLE)
        result.alpha_composite(tile, (center - 352, 0))
    alpha = np.asarray(result.getchannel("A"))
    assert alpha.min() == 0 and alpha.max() > 235
    assert not np.any(alpha[:20]) and not np.any(alpha[-20:])
    assert not np.any(alpha[:, :20]) and not np.any(alpha[:, -20:])
    return result


def sheet(styles, sprites):
    board = ink.paper(1536, 1052, 191)
    draw = ImageDraw.Draw(board)
    draw.text((54, 27), "三国-国号", font=ink.label_font(37, 600), fill=(49, 53, 50))
    draw.text((1482, 40), "魏 / 蓝     蜀 / 橙     吴 / 绿", anchor="ra", font=ink.label_font(24), fill=(111, 114, 105))
    draw.line((54, 99, 1482, 99), fill=(211, 205, 191))
    for column, style in enumerate(styles):
        center = 392 + column * 752
        draw.text((center, 122), style["label"], anchor="ma", font=ink.label_font(29, 500), fill=(61, 65, 59))
        for row, faction in enumerate(ink.FACTIONS):
            sprite = sprites[(style["key"], faction["key"])]
            display = sprite.resize((700, 266), ink.RESAMPLE)
            y = 167 + row * 290
            board.alpha_composite(display, (center - 350, y))
            compact = sprite.resize((210, 80), ink.RESAMPLE)
            board.alpha_composite(compact, (center - 105, y + 201))
    return board.convert("RGB")


def main():
    names = ["comparison.png"] + [f"{s['key']}-sanguo-{f['key']}-transparent.png" for s in ink.STYLES for f in ink.FACTIONS]
    if any((OUT / name).exists() for name in names):
        raise SystemExit("Existing outputs: use a new version folder.")
    sprites = {}
    for style in ink.STYLES:
        for index, faction in enumerate(ink.FACTIONS):
            sprite = title_sprite(faction, style, 321 + index * 100)
            sprites[(style["key"], faction["key"])] = sprite
            ink.save(sprite, OUT / f"{style['key']}-sanguo-{faction['key']}-transparent.png")
    ink.save(sheet(ink.STYLES, sprites), OUT / "comparison.png")
    print("PASS: 6 full titles, RGBA, safe transparent margins; exact text 三国-魏 / 三国-蜀 / 三国-吴")


if __name__ == "__main__":
    main()
