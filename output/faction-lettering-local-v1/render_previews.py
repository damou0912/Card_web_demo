"""Offline font-and-material lettering studies; no API calls or Unity changes."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


OUT = Path(__file__).resolve().parent
FONTS = Path("C:/Windows/Fonts")
SIZE = 640
LETTERS = ("魏", "蜀", "吴")
FACTIONS = ("wei", "shu", "wu")
RNG = np.random.default_rng(20260923)
LABEL_FONT = FONTS / "NotoSansSC-VF.ttf"
STYLES = (
    {
        "id": "01-cinnabar",
        "name": "朱砂印章",
        "tag": "方正 · 厚重 · 印泥质感",
        "font": FONTS / "NotoSerifSC-VF.ttf",
        "weight": 900,
        "paper": (241, 231, 209),
        "fg": (110, 43, 33),
    },
    {
        "id": "02-ink",
        "name": "水墨书法",
        "tag": "行楷 · 飞白 · 笔锋",
        "font": FONTS / "STXINGKA.TTF",
        "weight": None,
        "paper": (236, 233, 221),
        "fg": (40, 44, 44),
    },
    {
        "id": "03-bronze",
        "name": "青铜金属",
        "tag": "金铜 · 浮雕 · 冷色底",
        "font": FONTS / "NotoSerifSC-VF.ttf",
        "weight": 900,
        "paper": (21, 31, 37),
        "fg": (228, 196, 131),
    },
)


def font(path, size, weight=None):
    face = ImageFont.truetype(str(path), size)
    if weight is not None:
        try:
            axes = face.get_variation_axes()
        except OSError:
            axes = []
        if axes:
            values = [axis["default"] for axis in axes]
            for index, axis in enumerate(axes):
                if b"weight" in axis["name"].lower():
                    values[index] = min(axis["maximum"], max(axis["minimum"], weight))
            face.set_variation_by_axes(values)
    return face


def noise(width, height, scale):
    """Low-frequency reproducible material variation, normalized to 0..1."""
    array = RNG.integers(0, 256, (max(2, height // scale), max(2, width // scale)), dtype=np.uint8)
    return np.asarray(
        Image.fromarray(array).resize((width, height), Image.Resampling.BICUBIC),
        dtype=np.float32,
    ) / 255.0


def shifted(mask, x, y):
    result = Image.new("L", mask.size)
    result.paste(mask, (x, y))
    return result


def rgba(color, alpha):
    result = Image.new("RGBA", alpha.size, (*color, 255))
    result.putalpha(alpha)
    return result


def glyph_mask(text, style):
    face = font(style["font"], 560, style["weight"])
    box = face.getbbox(text)
    raw = Image.new("L", (box[2] - box[0] + 16, box[3] - box[1] + 16))
    ImageDraw.Draw(raw).text((8 - box[0], 8 - box[1]), text, font=face, fill=255)
    raw = raw.crop(raw.getbbox())
    target = (390, 418) if style["id"] == "01-cinnabar" else (456, 448)
    if style["id"] == "01-cinnabar":
        # The preview stamp deliberately compacts the type into a square seal.
        raw = raw.resize(target, Image.Resampling.LANCZOS)
    else:
        raw.thumbnail(target, Image.Resampling.LANCZOS)
    result = Image.new("L", (SIZE, SIZE))
    result.paste(raw, ((SIZE - raw.width) // 2, (SIZE - raw.height) // 2))
    return result


def cinnabar(mask):
    mask = mask.copy()
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((59, 48, 581, 592), radius=15, outline=255, width=17)
    draw.rounded_rectangle((86, 75, 554, 565), radius=7, outline=255, width=3)
    alpha = np.asarray(mask, dtype=np.float32)
    rough = noise(SIZE, SIZE, 4)
    cloud = noise(SIZE, SIZE, 35)
    damage = np.clip((0.24 - rough) * 2.5, 0, 0.68)
    fine = RNG.random((SIZE, SIZE))
    alpha *= (0.82 + 0.18 * cloud) * (1 - damage)
    alpha[fine < 0.0025] *= 0.22
    tex = cloud * 0.62 + rough * 0.38
    colors = np.stack((139 + tex * 36, 36 + tex * 15, 26 + tex * 12), axis=-1)
    result = Image.fromarray(np.clip(colors, 0, 255).astype(np.uint8)).convert("RGBA")
    result.putalpha(Image.fromarray(alpha.astype(np.uint8)))
    return result


def ink(mask):
    cloud = noise(SIZE, SIZE, 46)
    fiber = noise(SIZE, SIZE, 3)
    alpha = np.asarray(mask, dtype=np.float32) * (0.91 + cloud * 0.09)
    # Sparse fine cuts reveal the paper without changing any character strokes.
    dry = Image.new("L", (SIZE, SIZE))
    draw = ImageDraw.Draw(dry)
    for _ in range(66):
        x, y = int(RNG.integers(110, 529)), int(RNG.integers(110, 529))
        length = int(RNG.integers(10, 48))
        draw.line((x, y, x + length // 4, y + length), fill=int(RNG.integers(28, 110)), width=1)
    alpha *= 1 - np.asarray(dry, dtype=np.float32) / 255.0
    tex = cloud * 0.8 + fiber * 0.2
    colors = np.stack((17 + tex * 21, 23 + tex * 20, 23 + tex * 19), axis=-1)
    paint = Image.fromarray(colors.astype(np.uint8)).convert("RGBA")
    paint.putalpha(Image.fromarray(alpha.astype(np.uint8)))
    bleed = mask.filter(ImageFilter.GaussianBlur(1.5)).point(lambda value: int(value * 0.12))
    result = rgba((54, 59, 57), bleed)
    result.alpha_composite(paint)
    return result


def bronze(mask):
    result = Image.new("RGBA", (SIZE, SIZE))
    shadow = shifted(mask.filter(ImageFilter.GaussianBlur(8)), 5, 13)
    result.alpha_composite(rgba((3, 8, 12), shadow.point(lambda value: int(value * 0.65))))
    for offset in range(8, 0, -1):
        result.alpha_composite(rgba((73 + offset * 2, 48 + offset, 23), shifted(mask, offset, offset)))
    outer = mask.filter(ImageFilter.MaxFilter(7))
    result.alpha_composite(rgba((94, 67, 33), outer))
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    position = np.clip((yy + xx * 0.22) / (SIZE * 1.22), 0, 1)
    stops = np.array([0, 0.18, 0.37, 0.49, 0.58, 0.77, 1])
    palette = np.array([[139, 91, 40], [240, 202, 124], [188, 129, 57], [255, 231, 164],
                        [124, 77, 34], [202, 148, 68], [137, 94, 42]])
    material = np.stack([np.interp(position, stops, palette[:, channel]) for channel in range(3)], axis=-1)
    material += (noise(SIZE, SIZE, 5)[..., None] - 0.5) * 20
    material += (RNG.random((SIZE, SIZE, 1)) - 0.5) * 7
    paint = Image.fromarray(np.clip(material, 0, 255).astype(np.uint8)).convert("RGBA")
    paint.putalpha(mask)
    result.alpha_composite(paint)
    highlights = ImageChops.subtract(mask, shifted(mask, 4, 4))
    lowlights = ImageChops.subtract(mask, shifted(mask, -4, -4))
    result.alpha_composite(rgba((255, 230, 166), highlights.point(lambda value: int(value * 0.85))))
    result.alpha_composite(rgba((57, 39, 21), lowlights.point(lambda value: int(value * 0.8))))
    return result


def backdrop(width, height, color, dark=False):
    grain = RNG.normal(0, 0.52 if dark else 0.72, (height, width, 1))
    cloud = (noise(width, height, 180)[..., None] - 0.5) * (5 if dark else 7)
    pixels = np.clip(np.array(color)[None, None, :] + grain + cloud, 0, 255).astype(np.uint8)
    return Image.fromarray(pixels).convert("RGBA")


def save(image, filename):
    target = OUT / filename
    if target.exists():
        raise FileExistsError(f"Refusing to replace existing preview: {target.name}")
    image.save(target, optimize=True)
    print(f"SAVED {target.name} {image.width}x{image.height}")


def render_panel(style, sprites, width=1536, height=620):
    dark = style["id"] == "03-bronze"
    panel = backdrop(width, height, style["paper"], dark)
    draw = ImageDraw.Draw(panel)
    fg = style["fg"]
    muted = (171, 166, 146) if dark else (126, 112, 95)
    draw.text((62, 38), style["id"][:2], font=font(LABEL_FONT, 24, 600), fill=fg)
    draw.text((120, 26), style["name"], font=font(LABEL_FONT, 39, 700), fill=fg)
    draw.text((width - 64, 43), style["tag"], anchor="ra", font=font(LABEL_FONT, 22, 400), fill=muted)
    draw.line((62, 98, width - 62, 98), fill=(*fg, 90), width=1)
    centers = (width // 6, width // 2, width * 5 // 6)
    for center, sprite in zip(centers, sprites):
        display = sprite.resize((420, 420), Image.Resampling.LANCZOS)
        panel.alpha_composite(display, (center - 210, 104))
    draw.text((66, 553), "小尺寸预览", font=font(LABEL_FONT, 20, 400), fill=muted)
    for center, sprite in zip(centers, sprites):
        compact = sprite.crop((34, 30, 609, 609)).resize((56, 56), Image.Resampling.LANCZOS)
        panel.alpha_composite(compact, (center - 28, 543))
    return panel.convert("RGB")


def main():
    expected = ["comparison.png"] + [style["id"] + ".png" for style in STYLES]
    expected += [f"{style['id']}-{name}-transparent.png" for style in STYLES for name in FACTIONS]
    if any((OUT / name).exists() for name in expected):
        raise SystemExit("Output already exists; use a new version directory before rerunning.")
    processors = (cinnabar, ink, bronze)
    panels = []
    for style, process in zip(STYLES, processors):
        sprites = []
        for letter, faction in zip(LETTERS, FACTIONS):
            sprite = process(glyph_mask(letter, style))
            save(sprite, f"{style['id']}-{faction}-transparent.png")
            sprites.append(sprite)
        panel = render_panel(style, sprites)
        save(panel, style["id"] + ".png")
        panels.append(panel)
    board = Image.new("RGB", (1536, 3 * 620 + 2 * 14), (210, 205, 192))
    for index, panel in enumerate(panels):
        board.paste(panel, (0, index * 634))
    save(board, "comparison.png")


if __name__ == "__main__":
    main()
