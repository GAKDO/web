"""부스 사진에 5% 눈금을 그려 노트북 면 네 모서리를 사진 비율로 읽게 한다(3D 핀 보정, docs/pin-calibration.md).

사용: python scripts/pin-grid.py <사진.jpg> [<사진.jpg> ...]  → 같은 폴더에 <사진 이름>.grid.png(이미 있으면 멈춤, .grid.png 입력은 건너뜀)
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
    out = grid_path(path)
    im.save(out)
    return out


def grid_path(path: Path) -> Path:
    # 원본 이름 전체를 남겨(CAM1.jpg → CAM1.jpg.grid.png) 확장자만 다른 사진끼리 결과가 겹치지 않게 한다
    return path.with_name(path.name + ".grid.png")


if __name__ == "__main__":
    inputs = [Path(a) for a in sys.argv[1:] if not a.endswith(".grid.png")]
    for p in inputs:
        if grid_path(p).exists():
            sys.exit(f"이미 있음, 덮어쓰지 않음: {grid_path(p)}")
    for p in inputs:
        print(draw_grid(p))
