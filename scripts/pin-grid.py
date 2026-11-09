"""부스 사진에 5% 눈금을 그려 노트북 면 네 모서리를 사진 비율로 읽게 한다(3D 핀 보정, docs/pin-calibration.md).

사용: python scripts/pin-grid.py <사진.jpg> [<사진.jpg> ...]  → 같은 폴더에 <이름>.grid.png
Pillow만 쓴다(pip install pillow).
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw


def draw_grid(path: Path) -> Path:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    d = ImageDraw.Draw(im)
    for i in range(1, 20):
        color = (0, 255, 0) if i % 2 == 0 else (0, 130, 0)
        x, y = w * i / 20, h * i / 20
        d.line([(x, 0), (x, h)], fill=color, width=1)
        d.line([(0, y), (w, y)], fill=color, width=1)
        d.text((x + 3, h - 16), str(i * 5), fill=(255, 255, 0))
        d.text((3, y - 14), str(i * 5), fill=(255, 255, 0))
    out = path.with_suffix(".grid.png")
    im.save(out)
    return out


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        print(draw_grid(Path(arg)))
