"""Makes the deployment copy of a card picture: 730x548 (twice the 365px card width) WebP with alpha.

The original PNG stays where the artist delivered it (design/...); only the copy goes to public/.
Usage: py tools/prepare-card-image.py <original.png> <public/media/images/name.webp>
"""
import sys
from PIL import Image

SIZE = (730, 548)

source, target = sys.argv[1], sys.argv[2]
image = Image.open(source).convert('RGBA')
if abs(image.width / image.height - 4 / 3) > 0.01:
    sys.exit(f'{source}: expected a 4:3 picture, got {image.width}x{image.height}')
image.resize(SIZE, Image.LANCZOS).save(target, 'WEBP', quality=90, alpha_quality=100, method=6)
print(f'{target}: {SIZE[0]}x{SIZE[1]}')
