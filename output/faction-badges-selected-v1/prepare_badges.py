"""Crop approved layout 1 into aligned Unity sprites; preserve source previews."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "output/faction-ink-layouts-v5"
DESTINATION = ROOT / "UnityCard_demo/Assets/Resources/UI/FactionBadges"
PREVIEW = Path(__file__).resolve().parent / "selected-badges.png"
FACTIONS = (("wei", "魏 · 蓝"), ("shu", "蜀 · 橙"), ("wu", "吴 · 绿"))


def main():
    paths = [DESTINATION / f"sanguo_{name}.png" for name, _ in FACTIONS]
    if PREVIEW.exists() or any(path.exists() for path in paths):
        raise SystemExit("Refusing to overwrite existing assets or preview.")
    images = [Image.open(SOURCE / f"a-vertical-title-{name}-transparent.png").convert("RGBA") for name, _ in FACTIONS]
    boxes = [image.getchannel("A").getbbox() for image in images]
    assert all(boxes), "Empty source image"
    # A single crop rectangle prevents baseline/anchor shifts between factions.
    crop = (min(b[0] for b in boxes) - 18, min(b[1] for b in boxes) - 18,
            max(b[2] for b in boxes) + 18, max(b[3] for b in boxes) + 18)
    assert crop[0] >= 0 and crop[1] >= 0 and crop[2] <= 960 and crop[3] <= 700
    preview = Image.new("RGB", (1380, 430), (244, 240, 230))
    draw = ImageDraw.Draw(preview)
    label_font = ImageFont.truetype("C:/Windows/Fonts/NotoSansSC-VF.ttf", 25)
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for index, ((name, label), source, path) in enumerate(zip(FACTIONS, images, paths)):
        cropped = source.crop(crop)
        cropped.thumbnail((736, 608), Image.Resampling.LANCZOS)
        sprite = Image.new("RGBA", (768, 640))
        sprite.alpha_composite(cropped, ((768 - cropped.width) // 2, (640 - cropped.height) // 2))
        alpha = sprite.getchannel("A")
        assert alpha.getextrema()[0] == 0 and alpha.getextrema()[1] == 255
        b = alpha.getbbox()
        assert b[0] >= 16 and b[1] >= 16 and b[2] <= 752 and b[3] <= 624
        sprite.save(path, optimize=True)
        display = sprite.resize((420, 350), Image.Resampling.LANCZOS)
        preview.paste(display, (20 + index * 460, 48), display)
        draw.text((230 + index * 460, 12), label, font=label_font, anchor="ma", fill=(60, 64, 59))
        print(f"SAVED {path.relative_to(ROOT).as_posix()} 768x640 RGBA")
    preview.save(PREVIEW, optimize=True)
    print(f"PASS: shared source crop {crop}; 3 separate sprites, transparent safe margins; original previews retained.")


if __name__ == "__main__":
    main()
