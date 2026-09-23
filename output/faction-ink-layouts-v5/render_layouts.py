"""Optional title separator: omit in stacked layouts, retain in horizontal type."""

import importlib.util
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "ink_layouts_v4", ROOT.parent / "faction-ink-layouts-v4" / "render_layouts.py"
)
layouts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(layouts)


def vertical_title(faction, glyph, prefix, seed):
    canvas = Image.new("RGBA", (layouts.W, layouts.H))
    y = np.linspace(176, 542, 110)
    x = 292 + np.sin(np.linspace(0, np.pi * 1.7, 110)) * 5
    layouts.stroke(canvas, np.column_stack((x, y)), 7, faction["hue"], seed, 0.42)
    # Recenter the two-character title after omitting the trailing hyphen.
    layouts.place(canvas, prefix["三"], (210, 282), (119, 100))
    layouts.place(canvas, prefix["国"], (210, 414), (121, 135))
    layouts.place(canvas, glyph, (551, 350), (511, 509))
    return canvas


def horizontal_prefix_without_hyphen(prefix):
    result = Image.new("RGBA", (352, 214))
    layouts.place(result, prefix["三"], (92, 107), (160, 154))
    layouts.place(result, prefix["国"], (262, 107), (162, 177))
    return result


def ink_circle(faction, glyph, prefix, seed):
    canvas = Image.new("RGBA", (layouts.W, layouts.H))
    angle = np.linspace(np.deg2rad(-61), np.deg2rad(260), 240)
    radius_x = 302 + np.sin(angle * 3.2) * 6
    radius_y = 286 + np.sin(angle * 2.7) * 4
    points = np.column_stack((layouts.W / 2 + np.cos(angle) * radius_x,
                              layouts.H / 2 + np.sin(angle) * radius_y))
    layouts.stroke(canvas, points, 22, faction["hue"], seed, 0.69)
    layouts.place(canvas, horizontal_prefix_without_hyphen(prefix),
                  (layouts.W / 2, 183), (188, 105))
    layouts.place(canvas, glyph, (layouts.W / 2, 399), (359, 340))
    return canvas


def main():
    # Only this imported module instance is configured; older source and images stay intact.
    layouts.ROOT = ROOT
    layouts.LAYOUTS = (
        ("a-vertical-title", "A   竖签大字", "省略短横线，题签重新居中"),
        ("b-horizontal-brush", "B   横向题字", "保留短横线，区分前缀与国号"),
        ("c-ink-circle", "C   墨圈徽记", "省略短横线，上下分层"),
    )
    layouts.vertical_title = vertical_title
    layouts.ink_circle = ink_circle
    layouts.main()


if __name__ == "__main__":
    main()
