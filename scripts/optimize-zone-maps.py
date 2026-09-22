"""Run after fetch-zone-maps.mjs; requires Pillow. Preserve pixel dimensions."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
folder = (root / 'public' / 'maps').resolve()
manifest_path = root / 'data' / 'zone-maps.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for zone, asset in manifest.items():
    source = (root / 'public' / asset['path']).resolve()
    assert source.parent == folder
    with Image.open(source) as original:
        image = original.convert('RGB')
        target = folder / f'{zone}.webp'
        image.save(target, 'WEBP', quality=90, method=4)
        image.thumbnail((320, 320))
        image.save(folder / f'{zone}-thumb.webp', 'WEBP', quality=75)
    asset['path'] = f'maps/{zone}.webp'
    asset['thumbnail'] = f'maps/{zone}-thumb.webp'
    if source != target:
        source.unlink()
    print(f'{zone}: {target.stat().st_size // 1024} KB')
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
