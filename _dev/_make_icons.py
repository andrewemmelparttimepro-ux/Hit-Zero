"""Generate Hit Zero PWA icons using the real HIT'ZERO wordmark.

Renders HIT / ZERO stacked in Fraunces Italic 900 (variable font) with the
teal->pink gradient applied only to the final 'O', exactly matching the
.hz-wordmark + .hz-zero CSS from hit_zero_web/styles/web.css.

Outputs into pwa/icons/:
  icon-192.png, icon-512.png                 (rounded, any-purpose)
  icon-192-maskable.png, icon-512-maskable.png   (full bleed, maskable)
  apple-touch-icon.png                       (180x180, iOS)
  favicon-32.png
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, glob

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "pwa", "icons")
os.makedirs(OUT, exist_ok=True)

INK = (5, 5, 7, 255)
TEAL = (39, 207, 215, 255)
PINK = (249, 127, 172, 255)
WHITE = (255, 255, 255, 255)

FONT_PATH = os.path.join(ROOT, "_fonts", "Fraunces-Italic.ttf")


def load_font(size, weight=900, opsz=144):
    """Load Fraunces Italic at requested size + variation axes."""
    font = ImageFont.truetype(FONT_PATH, size)
    try:
        # Variable font axes
        font.set_variation_by_axes([weight, 0, float(opsz), 0])
    except Exception:
        pass
    return font


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))


def make_gradient(size, c1, c2, angle_deg=135):
    """Diagonal gradient. 135deg = top-left -> bottom-right."""
    import math
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    px = img.load()
    # Project onto gradient axis: direction (cos, sin)
    a = math.radians(angle_deg - 90)  # CSS angles: 0=up, 90=right, 135=right-down
    dx, dy = math.cos(a), math.sin(a)
    # Normalise so that the full diagonal goes 0..1
    corners = [(0, 0), (w, 0), (0, h), (w, h)]
    projs = [x * dx + y * dy for (x, y) in corners]
    p_min, p_max = min(projs), max(projs)
    span = p_max - p_min or 1
    for y in range(h):
        for x in range(w):
            t = ((x * dx + y * dy) - p_min) / span
            px[x, y] = lerp(c1, c2, t)
    return img


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m


def draw_wordmark_icon(size, *, maskable=False):
    """Render HIT / ZERO stacked wordmark on the ink canvas."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Background: ink with two soft radial glows (teal upper-left, pink lower-right)
    bg = Image.new("RGBA", (size, size), INK)
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r = int(size * 0.55)
    gd.ellipse((-r // 2, -r // 2, r, r), fill=(TEAL[0], TEAL[1], TEAL[2], 42))
    gd.ellipse((size - r, size - r, size + r // 2, size + r // 2),
               fill=(PINK[0], PINK[1], PINK[2], 42))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.08))
    bg.alpha_composite(glow)
    img.alpha_composite(bg)

    # Typography: target 2 lines with line-height 0.82 and -0.055em tracking
    # "HIT" and "ZERO" — pick font size so ZERO (wider) fits in ~78% canvas width
    # Maskable: stay inside 80% safe zone
    target_width_ratio = 0.64 if maskable else 0.82
    target_width_px = int(size * target_width_ratio)

    # Binary-search font size so "ZERO" width matches target
    lo, hi = 20, size * 2
    while lo < hi:
        mid = (lo + hi + 1) // 2
        f = load_font(mid)
        # Approximate tracking -0.055em ≈ -5.5% of em per glyph gap
        w_raw = text_width(f, "ZERO")
        # Apply tracking: 3 gaps in "ZERO"
        w_adj = int(w_raw - 3 * mid * 0.055)
        if w_adj <= target_width_px:
            lo = mid
        else:
            hi = mid - 1
    font_size = lo
    font = load_font(font_size)

    # Compute positions for stacked lines
    line_h = int(font_size * 0.82)
    hit_w = text_width(font, "HIT")
    zero_w = text_width(font, "ZERO")
    # Apply tracking visually by drawing glyph-by-glyph with reduced advance
    tracking = -int(font_size * 0.055)

    # Vertical centering: stack total height ≈ 2 * line_h
    block_h = 2 * line_h
    top = (size - block_h) // 2 - int(font_size * 0.05)

    # Draw HIT (centered) in white
    draw_tracked(img, "HIT", font, top, size, WHITE, tracking)
    # Draw ZER in white + O in gradient
    draw_tracked_mixed(img, "ZER", "O", font, top + line_h, size, WHITE, tracking,
                       gradient=(TEAL, PINK))

    # Rounded corners unless maskable
    if not maskable:
        mask = rounded_mask(size, int(size * 0.22))
        final = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        final.paste(img, (0, 0), mask)
        return final
    return img


def text_width(font, s):
    return font.getbbox(s)[2] - font.getbbox(s)[0]


def draw_tracked(img, text, font, y, canvas_w, color, tracking):
    """Draw text horizontally centered with custom per-glyph tracking."""
    widths = [text_width(font, c) for c in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = (canvas_w - total) // 2
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for i, c in enumerate(text):
        bbox = font.getbbox(c)
        ld.text((x - bbox[0], y - bbox[1]), c, font=font, fill=color)
        x += widths[i] + tracking
    img.alpha_composite(layer)


def draw_tracked_mixed(img, left, right, font, y, canvas_w, color, tracking, gradient):
    """Draw left text in `color` and right text in gradient."""
    widths_l = [text_width(font, c) for c in left]
    widths_r = [text_width(font, c) for c in right]
    total = sum(widths_l) + sum(widths_r) + tracking * (len(left) + len(right) - 1)
    x = (canvas_w - total) // 2

    # Draw left (white)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for i, c in enumerate(left):
        bbox = font.getbbox(c)
        ld.text((x - bbox[0], y - bbox[1]), c, font=font, fill=color)
        x += widths_l[i] + tracking

    # Draw right (gradient) — render each glyph as a mask, fill with gradient
    for i, c in enumerate(right):
        bbox = font.getbbox(c)
        gw = widths_r[i]
        gh = font.size * 2  # tall enough for ascenders/descenders
        mask = Image.new("L", (gw + abs(bbox[0]) + 2, gh), 0)
        md = ImageDraw.Draw(mask)
        md.text((-bbox[0], -bbox[1]), c, font=font, fill=255)
        grad = make_gradient(mask.size, gradient[0], gradient[1], angle_deg=135)
        glyph = Image.new("RGBA", mask.size, (0, 0, 0, 0))
        glyph.paste(grad, (0, 0), mask)
        layer.alpha_composite(glyph, (x, y))
        x += gw + tracking

    img.alpha_composite(layer)


def save(img, name):
    p = os.path.join(OUT, name)
    img.save(p, "PNG", optimize=True)
    return p, os.path.getsize(p)


if __name__ == "__main__":
    pairs = [
        (512, False, "icon-512.png"),
        (192, False, "icon-192.png"),
        (180, False, "apple-touch-icon.png"),
        (512, True,  "icon-512-maskable.png"),
        (192, True,  "icon-192-maskable.png"),
        (32,  False, "favicon-32.png"),
    ]
    for size, maskable, name in pairs:
        img = draw_wordmark_icon(size, maskable=maskable)
        p, sz = save(img, name)
        print(f"  {size:>3} {'mask' if maskable else 'any ':4}  {sz:>6}  {p}")
