"""Three local typographic alternatives. No API, font embedding or Unity edits."""

import importlib.util
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "ink_v2", ROOT.parent / "faction-ink-local-v2" / "render_ink.py"
)
ink = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ink)
W, H = 960, 700
LAYOUTS = (
    ("a-vertical-title", "A   竖签大字", "小题签，大国号"),
    ("b-horizontal-brush", "B   横向题字", "横排错落，一笔墨痕"),
    ("c-ink-circle", "C   墨圈徽记", "围墨留白，收拢成章"),
)
NEUTRAL = dict(hue=(57, 63, 60), dark=(21, 30, 27), pale=(134, 144, 130))


def tight(image, pad=6, threshold=4):
    alpha = image.getchannel("A").point(lambda value: 255 if value > threshold else 0)
    box = alpha.getbbox()
    if not box:
        raise ValueError("Empty lettering")
    x0, y0, x1, y1 = box
    return image.crop((max(0, x0 - pad), max(0, y0 - pad), min(image.width, x1 + pad), min(image.height, y1 + pad)))


def place(canvas, image, center, maximum):
    placed = tight(image)
    placed.thumbnail(maximum, ink.RESAMPLE)
    xy = (round(center[0] - placed.width / 2), round(center[1] - placed.height / 2))
    canvas.alpha_composite(placed, xy)


def common_prefix():
    result = {}
    for index, char in enumerate("三国"):
        result[char] = ink.render_letter(dict(NEUTRAL, char=char), ink.STYLES[1], 507 + index)
    # The actual hyphen retains its reading as a separator, not a third ideogram.
    mask = Image.new("L", (128, 34))
    draw = ImageDraw.Draw(mask)
    draw.polygon([(9, 17), (26, 12), (110, 14), (119, 19), (88, 21), (19, 23)], fill=235)
    result["-"] = Image.new("RGBA", mask.size, (45, 54, 50))
    result["-"].putalpha(mask.filter(ImageFilter.GaussianBlur(0.35)))
    return result


def horizontal_prefix(prefix, color=None):
    result = Image.new("RGBA", (456, 214))
    place(result, prefix["三"], (92, 107), (160, 154))
    place(result, prefix["国"], (262, 107), (162, 177))
    place(result, prefix["-"], (401, 108), (72, 22))
    if color is not None:
        tint = Image.new("RGBA", result.size, color)
        tint.putalpha(result.getchannel("A"))
        return tint
    return result


def material(mask, rgb, seed, opacity=1.0, dry=0.6):
    rng = np.random.default_rng(seed)
    width, height = mask.size
    cloud = ink.field(rng, 36, width, height)
    grain = ink.field(rng, 3, width, height)
    alpha = np.asarray(mask, dtype=float) / 255
    alpha *= opacity * (0.66 + cloud * 0.34)
    alpha *= 1 - np.clip((0.40 - grain) * 1.9, 0, 0.8) * dry
    paint = np.array(rgb)[None, None, :] * (0.85 + cloud[..., None] * 0.22)
    result = ink.colored_layer(paint, alpha)
    bleed = np.asarray(mask.filter(ImageFilter.GaussianBlur(3.5)), dtype=float) / 255
    halo = ink.colored_layer(rgb, bleed * (1 - np.asarray(mask, dtype=float) / 255) * 0.18 * opacity)
    halo.alpha_composite(result)
    return halo


def stroke(canvas, points, width, rgb, seed, opacity=1.0):
    rng = np.random.default_rng(seed)
    path = np.array(points, dtype=float)
    t = np.linspace(0, 1, len(path))
    derivative = np.gradient(path, axis=0)
    derivative /= np.maximum(np.linalg.norm(derivative, axis=1), 0.01)[:, None]
    normal = np.column_stack((-derivative[:, 1], derivative[:, 0]))
    envelope = (np.sin(np.pi * t) ** 0.38) * width / 2 + 1
    mask = Image.new("L", canvas.size)
    draw = ImageDraw.Draw(mask)
    contour = np.concatenate((path + normal * envelope[:, None], (path - normal * envelope[:, None])[::-1]))
    draw.polygon([tuple(p) for p in contour], fill=225)
    for _ in range(int(width * 1.5)):
        offset = rng.uniform(-0.65, 0.65) * width
        bristle = path + normal * offset * (np.sin(np.pi * t) ** 0.30)[:, None]
        bristle += rng.normal(0, 0.6, bristle.shape)
        start, end = int(rng.integers(0, max(1, len(path) // 4))), int(rng.integers(len(path) * 3 // 4, len(path)))
        draw.line([tuple(p) for p in bristle[start:end]], fill=int(rng.integers(35, 190)), width=1)
    canvas.alpha_composite(material(mask, rgb, seed, opacity))


def vertical_title(faction, glyph, prefix, seed):
    canvas = Image.new("RGBA", (W, H))
    # A narrow, pale, broken ink divider is secondary to the faction glyph.
    y = np.linspace(176, 542, 110)
    x = 292 + np.sin(np.linspace(0, np.pi * 1.7, 110)) * 5
    stroke(canvas, np.column_stack((x, y)), 7, faction["hue"], seed, 0.42)
    place(canvas, prefix["三"], (210, 233), (119, 100))
    place(canvas, prefix["国"], (210, 365), (121, 135))
    place(canvas, prefix["-"], (210, 480), (61, 21))
    place(canvas, glyph, (551, 350), (511, 509))
    return canvas


def horizontal_title(faction, glyph, prefix, seed):
    canvas = Image.new("RGBA", (W, H))
    x = np.linspace(112, 869, 160)
    y = 502 + np.sin(np.linspace(0, np.pi, 160)) * 17 - np.linspace(0, 1, 160) * 60
    stroke(canvas, np.column_stack((x, y)), 27, faction["hue"], seed, 0.34)
    place(canvas, horizontal_prefix(prefix), (281, 331), (329, 171))
    place(canvas, glyph, (633, 323), (416, 410))
    return canvas


def ink_circle(faction, glyph, prefix, seed):
    canvas = Image.new("RGBA", (W, H))
    # An open brush ring frames, but never intersects, the full title.
    angle = np.linspace(np.deg2rad(-61), np.deg2rad(260), 240)
    radius_x = 302 + np.sin(angle * 3.2) * 6
    radius_y = 286 + np.sin(angle * 2.7) * 4
    points = np.column_stack((W / 2 + np.cos(angle) * radius_x, H / 2 + np.sin(angle) * radius_y))
    stroke(canvas, points, 22, faction["hue"], seed, 0.69)
    place(canvas, horizontal_prefix(prefix), (W / 2 - 6, 183), (224, 105))
    place(canvas, glyph, (W / 2, 399), (359, 340))
    return canvas


def validate(image):
    assert image.mode == "RGBA"
    alpha = np.asarray(image.getchannel("A"))
    assert alpha.min() == 0 and alpha.max() > 235
    assert not np.any(alpha[:20]) and not np.any(alpha[-20:])
    assert not np.any(alpha[:, :20]) and not np.any(alpha[:, -20:])


def make_panel(layout, images, index):
    board = ink.paper(1536, 600, 206 + index)
    draw = ImageDraw.Draw(board)
    draw.text((58, 28), layout[1], font=ink.label_font(36, 600), fill=(47, 53, 48))
    draw.text((1478, 44), layout[2], font=ink.label_font(22), fill=(111, 115, 105), anchor="ra")
    draw.line((58, 98, 1478, 98), fill=(211, 206, 193))
    for center, faction, sprite in zip((268, 768, 1268), ink.FACTIONS, images):
        draw.text((center, 120), faction["label"], font=ink.label_font(22, 500), fill=faction["hue"], anchor="ma")
        display = sprite.resize((496, 362), ink.RESAMPLE)
        board.alpha_composite(display, (center - 248, 150))
        compact = sprite.resize((126, 92), ink.RESAMPLE)
        board.alpha_composite(compact, (center - 63, 494))
    draw.text((58, 536), "缩小参考", font=ink.label_font(18), fill=(129, 126, 113))
    return board.convert("RGB")


def main():
    expected = ["comparison.png"] + [layout[0] + ".png" for layout in LAYOUTS]
    expected += [f"{layout[0]}-{f['key']}-transparent.png" for layout in LAYOUTS for f in ink.FACTIONS]
    if any((ROOT / name).exists() for name in expected):
        raise SystemExit("Refusing to overwrite a previous preview; choose a fresh version folder.")
    prefix = common_prefix()
    glyphs = {
        f["key"]: Image.open(ROOT.parent / "faction-ink-local-v2" / f"b-bold-drybrush-{f['key']}-transparent.png").convert("RGBA")
        for f in ink.FACTIONS
    }
    panels = []
    for index, (layout, build) in enumerate(zip(LAYOUTS, (vertical_title, horizontal_title, ink_circle))):
        sprites = []
        for faction in ink.FACTIONS:
            sprite = build(faction, glyphs[faction["key"]], prefix, 507 + index)
            validate(sprite)
            ink.save(sprite, ROOT / f"{layout[0]}-{faction['key']}-transparent.png")
            sprites.append(sprite)
        panel = make_panel(layout, sprites, index)
        ink.save(panel, ROOT / (layout[0] + ".png"))
        panels.append(panel)
    comparison = Image.new("RGB", (1536, 1832), (213, 207, 193))
    for index, panel in enumerate(panels):
        comparison.paste(panel, (0, index * 616))
    ink.save(comparison, ROOT / "comparison.png")
    print("PASS: 3 layouts, 9 RGBA titles, safe transparent margins; no prior files changed.")


if __name__ == "__main__":
    main()
