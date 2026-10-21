"""Optional maintainer script. Requires Pillow + ReportLab; output is committed.
No generation or editing of the supplied artwork: originals are copied verbatim.
"""
from pathlib import Path
import shutil
from reportlab.graphics.barcode import qrencoder

root = Path(__file__).resolve().parents[1]
source = root.parent / 'upload'
names = {
    'jebediah crow.png': 'jebediah.png',
    'Gauze ghost with pumpkin and streamers.png': 'ghost.png',
    'Polished orange pumpkin lantern clip art.png': 'pumpkin.png',
    'Ectoplasmic Scanner With Electric Sparks.png': 'scanner.png',
    'Haunted Black Gauze Drape-2.png': 'drape.png',
    'Spooky-Fun Office Reception-3.png': 'reception.png',
    'Spooky Office Witch Doll Clip Art-1.png': 'witch.png',
}
for name, dest in names.items():
    shutil.copyfile(source / name, root / 'public/assets' / dest)

payloads = [(f'ghost-{i}', f'Ghost {i}') for i in range(1, 19)]
payloads += [(f'player-{color.lower()}', f'Player {color}') for color in ['Red','Green','Blue','Yellow','White','Black']]
payloads += [('test', 'TEST WAND')]
for name, payload in payloads:
    qr = qrencoder.QRCode(1, qrencoder.QRErrorCorrectLevel.M)
    qr.addData(payload)
    qr.make()
    modules = qr.modules
    size = len(modules) + 8  # Four-module white quiet zone on every edge.
    path = ' '.join(f'M{x+4},{y+4}h1v1h-1z' for y,row in enumerate(modules) for x,on in enumerate(row) if on)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" shape-rendering="crispEdges"><title>{payload}</title><path fill="white" d="M0 0h{size}v{size}H0z"/><path fill="black" d="{path}"/></svg>'
    (root / 'public/qr' / f'{name}.svg').write_text(svg)
print(f'Copied {len(names)} original assets; generated {len(payloads)} valid QR matrices.')
