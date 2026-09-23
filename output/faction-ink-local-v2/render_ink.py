"""Colored ink studies, rendered offline from installed type. Preview use only."""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
FONTS = Path("C:/Windows/Fonts")
S = 896
RESAMPLE = Image.Resampling.LANCZOS
FACTIONS = (
    dict(key="wei", char="魏", label="魏 · 蓝", hue=(31, 110, 168), dark=(12, 45, 78), pale=(102, 164, 204)),
    dict(key="shu", char="蜀", label="蜀 · 橙", hue=(214, 112, 31), dark=(135, 63, 16), pale=(238, 177, 104)),
    dict(key="wu", char="吴", label="吴 · 绿", hue=(43, 127, 78), dark=(15, 68, 46), pale=(126, 180, 133)),
)
STYLES = (
    dict(key="a-wet-ink", label="A   淡墨晕染", tag="水痕 · 浓淡 · 宣纸渗墨", dry=0.50, bleed=1.0, clusters=20, drops=16),
    dict(key="b-bold-drybrush", label="B   浓墨飞白", tag="枯笔 · 飞白 · 散锋墨点", dry=0.96, bleed=0.78, clusters=37, drops=29),
)


def u8(a):
    return np.clip(a, 0, 255).astype(np.uint8)


def field(rng, scale, w=S, h=S):
    a = rng.integers(0, 256, (max(3, h // scale), max(3, w // scale)), dtype=np.uint8)
    return np.asarray(Image.fromarray(a).resize((w, h), Image.Resampling.BICUBIC), dtype=np.float32) / 255


def colored_layer(rgb, alpha):
    a = Image.fromarray(u8(alpha * 255))
    if np.asarray(rgb).ndim == 1:
        result = Image.new("RGBA", a.size, tuple(int(v) for v in rgb))
    else:
        result = Image.fromarray(u8(rgb)).convert("RGBA")
    result.putalpha(a)
    return result


def label_font(size, weight=400):
    face = ImageFont.truetype(str(FONTS / "NotoSansSC-VF.ttf"), size)
    axes = face.get_variation_axes()
    face.set_variation_by_axes([min(a["maximum"], max(a["minimum"], weight)) if b"weight" in a["name"].lower() else a["default"] for a in axes])
    return face


def original_glyph(char):
    face = ImageFont.truetype(str(FONTS / "STXINGKA.TTF"), 790)
    b = face.getbbox(char)
    glyph = Image.new("L", (b[2] - b[0] + 32, b[3] - b[1] + 32))
    ImageDraw.Draw(glyph).text((16 - b[0], 16 - b[1]), char, font=face, fill=255)
    glyph = glyph.crop(glyph.getbbox())
    height = 554
    width = min(630, round(glyph.width * height / glyph.height))
    glyph = glyph.resize((width, height), RESAMPLE)
    canvas = Image.new("L", (S, S))
    canvas.paste(glyph, ((S - width) // 2, (S - height) // 2))
    return canvas


def displace(mask, rng):
    yy, xx = np.mgrid[:S, :S].astype(np.float32)
    xx += (field(rng, 9) - 0.5) * 4 + (field(rng, 42) - 0.5) * 3
    yy += (field(rng, 8) - 0.5) * 4 + (field(rng, 37) - 0.5) * 3
    xx, yy = np.clip(xx, 0, S - 2.01), np.clip(yy, 0, S - 2.01)
    x, y = xx.astype(int), yy.astype(int)
    fx, fy = xx - x, yy - y
    source = np.asarray(mask, dtype=np.float32)
    values = source[y, x] * (1 - fx) * (1 - fy) + source[y, x + 1] * fx * (1 - fy)
    values += source[y + 1, x] * (1 - fx) * fy + source[y + 1, x + 1] * fx * fy
    return Image.fromarray(u8(values))


def stroke_direction(alpha, x, y):
    """Find the long local stroke direction, so dry bristles follow the type."""
    best, angle = -1, 0
    distances = np.linspace(-52, 52, 33)
    for candidate in np.linspace(0, np.pi, 16, endpoint=False):
        xs = np.clip((x + np.cos(candidate) * distances).astype(int), 0, S - 1)
        ys = np.clip((y + np.sin(candidate) * distances).astype(int), 0, S - 1)
        score = np.sum(alpha[ys, xs])
        if score > best:
            best, angle = score, candidate
    return angle


def dry_bristles(mask, rng, count):
    alpha = np.asarray(mask, dtype=np.float32) / 255
    interior = np.asarray(mask.filter(ImageFilter.MinFilter(7))) > 240
    points = np.argwhere(interior)
    canvas = Image.new("L", (S, S))
    draw = ImageDraw.Draw(canvas)
    for _ in range(count):
        y, x = points[rng.integers(len(points))]
        angle = stroke_direction(alpha, x, y) + rng.uniform(-0.10, 0.10)
        direction = np.array([np.cos(angle), np.sin(angle)])
        normal = np.array([-direction[1], direction[0]])
        length = rng.uniform(35, 133)
        bend = rng.uniform(-8, 8)
        for _ in range(rng.integers(4, 10)):
            offset = rng.uniform(-12, 12)
            start, stop = rng.uniform(-0.58, -0.15), rng.uniform(0.1, 0.65)
            t = np.linspace(start, stop, 15)
            pos = np.array([x, y]) + t[:, None] * length * direction
            pos += (offset + np.sin((t - start) * np.pi) * bend)[:, None] * normal
            pos += rng.normal(0, 0.45, pos.shape)
            thickness = rng.uniform(0.4, 2.0)
            envelope = np.sin(np.linspace(0, np.pi, len(t))) ** 0.5 * thickness
            polygon = np.concatenate([pos + envelope[:, None] * normal, (pos - envelope[:, None] * normal)[::-1]])
            draw.polygon([tuple(point) for point in polygon], fill=int(rng.integers(155, 256)))
    return np.asarray(canvas.filter(ImageFilter.GaussianBlur(0.36)), dtype=np.float32) / 255


def feather_and_drops(mask, rng, count, pigment):
    m = np.asarray(mask, dtype=np.float32) / 255
    expanded = np.asarray(mask.filter(ImageFilter.MaxFilter(5)), dtype=np.float32) / 255
    edges = np.argwhere((expanded - m > 0.7) & (m < 0.1))
    soft = np.asarray(mask.filter(ImageFilter.GaussianBlur(5)), dtype=np.float32) / 255
    gy, gx = np.gradient(soft)
    canvas = Image.new("L", (S, S))
    draw = ImageDraw.Draw(canvas)
    for _ in range(310):
        y, x = edges[rng.integers(len(edges))]
        direction = -np.array([gx[y, x], gy[y, x]])
        direction /= np.linalg.norm(direction) + 1e-5
        end = np.array([x, y]) + direction * rng.uniform(2, 12)
        draw.line((x, y, *end), fill=int(rng.integers(15, 85)), width=1)
    bounds = mask.getbbox()
    outer = edges[(edges[:, 1] < bounds[0] + 65) | (edges[:, 1] > bounds[2] - 80) |
                  (edges[:, 0] > bounds[3] - 70)]
    for _ in range(count):
        y, x = outer[rng.integers(len(outer))]
        direction = -np.array([gx[y, x], gy[y, x]])
        direction /= np.linalg.norm(direction) + 1e-5
        center = np.array([x, y]) + direction * rng.uniform(13, 63) + rng.normal(0, 9, 2)
        cx, cy = np.clip(center, 50, S - 50)
        radius = rng.uniform(1.1, 4.5)
        draw.ellipse((cx - radius, cy - radius * 0.85, cx + radius, cy + radius), fill=int(rng.integers(38, 166)))
    layer = colored_layer(pigment, np.asarray(canvas, dtype=np.float32) / 255)
    return layer


def render_letter(faction, style, seed):
    rng = np.random.default_rng(seed)
    mask = displace(original_glyph(faction["char"]), rng)
    m = np.asarray(mask, dtype=np.float32) / 255
    cloud = field(rng, 84) * 0.62 + field(rng, 37) * 0.38
    cloud = np.clip((cloud - 0.24) / 0.53, 0, 1)
    grain = field(rng, 3)
    fiber = field(rng, 11)
    pale, hue, dark = (np.array(faction[k], dtype=float) for k in ("pale", "hue", "dark"))
    wet = style["key"] == "a-wet-ink"
    bleed1 = np.asarray(mask.filter(ImageFilter.GaussianBlur(4.3)), dtype=np.float32) / 255
    bleed2 = np.asarray(mask.filter(ImageFilter.GaussianBlur(12.5)), dtype=np.float32) / 255
    spread = np.asarray(mask.filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.GaussianBlur(3.5)), dtype=np.float32) / 255
    # Pools grow directly from letter strokes; no decorative smoke or drop shadow.
    halo = ((bleed2 * (0.16 + fiber * 0.20) + spread * 0.08) * (1 - m)) * style["bleed"]
    result = colored_layer(hue * 0.66 + pale * 0.34, halo)
    near = bleed1 * (0.25 + fiber * 0.24) * (1 - m)
    result.alpha_composite(colored_layer(hue, near))
    result.alpha_composite(feather_and_drops(mask, rng, style["drops"], hue * 0.85 + dark * 0.15))

    dry = dry_bristles(mask, rng, style["clusters"])
    granules = np.clip((0.37 - grain) * 1.8, 0, 0.45)
    density = (0.62 + cloud * 0.37) if wet else (0.80 + cloud * 0.20)
    alpha = m * density * (1 - dry * style["dry"]) * (1 - granules * (0.25 if wet else 0.70))
    # Keep fine strokes connected: strong bristle gaps affect wide strokes most.
    core = np.asarray(mask.filter(ImageFilter.MinFilter(9)), dtype=np.float32) / 255
    alpha = np.maximum(alpha, m * (1 - core) * 0.43)
    darkness = np.clip(cloud * (0.58 if wet else 0.67) + (0.08 if wet else 0.11), 0, 0.8)
    color = hue * (1 - darkness[..., None]) + dark * darkness[..., None]
    washed = np.clip((0.40 - cloud) * (1.6 if wet else 0.65), 0, 0.55)
    color = color * (1 - washed[..., None]) + pale * washed[..., None]
    color += (grain[..., None] - 0.5) * 11
    result.alpha_composite(colored_layer(color, alpha))

    # Uneven pigment accumulation: subdued, discontinuous rims, never a bevel.
    eroded = np.asarray(mask.filter(ImageFilter.MinFilter(7)), dtype=np.float32) / 255
    rim = np.maximum(m - eroded, 0) * (0.06 + fiber * 0.19) * (1 - dry * style["dry"])
    result.alpha_composite(colored_layer(dark, rim))
    return result


def paper(w, h, seed):
    rng = np.random.default_rng(seed)
    broad = (field(rng, 125, w, h) - 0.5)[..., None]
    fibers = (field(rng, 3, w, h) - 0.5)[..., None]
    a = np.array([246, 241, 230])[None, None] + broad * 7 + fibers * 2 + rng.normal(0, 0.45, (h, w, 1))
    return Image.fromarray(u8(a)).convert("RGBA")


def sheet(style, sprites):
    w, h = 1536, 680
    result = paper(w, h, 88)
    draw = ImageDraw.Draw(result)
    draw.text((58, 28), style["label"], font=label_font(40, 600), fill=(48, 52, 50))
    draw.text((1478, 44), style["tag"], font=label_font(22), anchor="ra", fill=(118, 115, 106))
    draw.line((58, 101, 1478, 101), fill=(211, 205, 191), width=1)
    for center, faction, sprite in zip((268, 768, 1268), FACTIONS, sprites):
        draw.text((center, 118), faction["label"], font=label_font(23, 500), anchor="ma", fill=faction["hue"])
        display = sprite.resize((488, 488), RESAMPLE)
        result.alpha_composite(display, (center - 244, 131))
        tight = sprite.crop((76, 93, 820, 803))
        for size, x in ((64, center - 58), (40, center + 32)):
            thumb = tight.copy()
            thumb.thumbnail((size, size), RESAMPLE)
            result.alpha_composite(thumb, (x, 608 + (64 - thumb.height) // 2))
    draw.text((58, 624), "缩小参考", font=label_font(19), fill=(130, 124, 110))
    return result.convert("RGB")


def save(image, path):
    if path.exists():
        raise FileExistsError(f"Refusing to replace: {path.name}")
    image.save(path, optimize=True)
    print(f"SAVED {path.name} {image.width}x{image.height}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=ROOT)
    args = parser.parse_args()
    out = args.out_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)
    targets = [out / "comparison.png"] + [out / f"{s['key']}.png" for s in STYLES]
    targets += [out / f"{s['key']}-{f['key']}-transparent.png" for s in STYLES for f in FACTIONS]
    if any(path.exists() for path in targets):
        raise SystemExit("Existing outputs: choose another version folder.")
    panels = []
    for style in STYLES:
        sprites = []
        for index, faction in enumerate(FACTIONS):
            sprite = render_letter(faction, style, 204 + index)
            alpha = np.asarray(sprite.getchannel("A"))
            assert alpha.min() == 0 and alpha.max() > 235
            assert not np.any(alpha[:32]) and not np.any(alpha[-32:])
            assert not np.any(alpha[:, :32]) and not np.any(alpha[:, -32:])
            save(sprite, out / f"{style['key']}-{faction['key']}-transparent.png")
            sprites.append(sprite)
        panel = sheet(style, sprites)
        save(panel, out / f"{style['key']}.png")
        panels.append(panel)
    comparison = Image.new("RGB", (1536, 1380), (209, 203, 190))
    comparison.paste(panels[0], (0, 0))
    comparison.paste(panels[1], (0, 700))
    save(comparison, out / "comparison.png")


if __name__ == "__main__":
    main()
