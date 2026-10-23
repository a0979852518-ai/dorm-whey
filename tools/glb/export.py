import asyncio, json, base64, struct, sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
import numpy as np
from playwright.async_api import async_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', '宿舍地圖.glb')


async def grab():
    async with async_playwright() as p:
        exe = os.environ.get('CHROME_PATH'); b = await p.chromium.launch(**({'executable_path': exe} if exe else {}), args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 800, 'height': 450})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + os.path.join(ROOT, 'dist', 'local.html'))
        await pg.wait_for_function("document.getElementById('btnStart').disabled===false", timeout=60000)
        data = await pg.evaluate(open(os.path.join(HERE, 'extract.js'), encoding='utf-8').read())
        await b.close()
        if errs: print('page errors:', errs[:3])
        return json.loads(data)


def build(d):
    objs = d['objects']
    bin_ = bytearray(); bufferViews = []; accessors = []
    def add_view(arr, target):
        nonlocal bin_
        while len(bin_) % 4: bin_ += b'\0'
        off = len(bin_); raw = arr.astype(np.float32).tobytes(); bin_ += raw
        bufferViews.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw), 'target': target})
        return len(bufferViews) - 1
    def add_acc(arr, typ, minmax=False):
        v = add_view(arr, 34962)
        a = {'bufferView': v, 'componentType': 5126, 'count': int(arr.shape[0]), 'type': typ}
        if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        accessors.append(a); return len(accessors) - 1

    images, textures, tex_index = [], [], {}
    def tex(key):
        if key in tex_index: return tex_index[key]
        url = d['textures'][key]; head, b64 = url.split(',', 1); mime = head.split(':')[1].split(';')[0]
        raw = base64.b64decode(b64)
        nonlocal bin_
        while len(bin_) % 4: bin_ += b'\0'
        off = len(bin_); bin_ += raw
        bufferViews.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)})
        images.append({'bufferView': len(bufferViews) - 1, 'mimeType': mime, 'name': key})
        textures.append({'source': len(images) - 1, 'sampler': 0})
        tex_index[key] = len(textures) - 1; return tex_index[key]

    materials, mat_index = [], {}
    def srgb2lin(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    def mat(m):
        key = json.dumps(m, sort_keys=True)
        if key in mat_index: return mat_index[key]
        h = m['color'].lstrip('#'); rgb = [srgb2lin(int(h[i:i + 2], 16)) for i in (0, 2, 4)]
        pbr = {'baseColorFactor': rgb + [m.get('opacity', 1)], 'metallicFactor': 0.0, 'roughnessFactor': 0.85}
        if m.get('tex'): pbr['baseColorTexture'] = {'index': tex(m['tex'])}
        mm = {'name': m.get('name', 'mat'), 'pbrMetallicRoughness': pbr, 'doubleSided': True}
        if m.get('opacity', 1) < 1: mm['alphaMode'] = 'BLEND'
        if m.get('unlit'): mm['extensions'] = {'KHR_materials_unlit': {}}
        materials.append(mm); mat_index[key] = len(materials) - 1; return mat_index[key]

    meshes, nodes = [], [{'name': '別喝我的乳清_宿舍地圖', 'children': []}]
    groups = {}
    for o in objs:
        pos = np.frombuffer(base64.b64decode(o['pos']), np.float32).reshape(-1, 3)
        if len(pos) == 0: continue
        nrm = np.frombuffer(base64.b64decode(o['nrm']), np.float32).reshape(-1, 3)
        nrm = np.nan_to_num(nrm); ln = np.linalg.norm(nrm, axis=1, keepdims=True); bad = ln[:, 0] < 1e-6
        nrm = np.where(ln > 1e-6, nrm / np.maximum(ln, 1e-6), [0, 1, 0]).astype(np.float32)
        attrs = {'POSITION': add_acc(pos, 'VEC3', True), 'NORMAL': add_acc(nrm, 'VEC3')}
        if o['uv']:
            uv = np.frombuffer(base64.b64decode(o['uv']), np.float32).reshape(-1, 2).copy(); uv[:, 1] = 1 - uv[:, 1]
            attrs['TEXCOORD_0'] = add_acc(uv, 'VEC2')
        meshes.append({'name': o['name'], 'primitives': [{'attributes': attrs, 'material': mat(o['mat'])}]})
        g = o['group']
        if g not in groups:
            nodes.append({'name': g, 'children': []}); groups[g] = len(nodes) - 1; nodes[0]['children'].append(groups[g])
        nodes.append({'name': o['name'], 'mesh': len(meshes) - 1}); nodes[groups[g]]['children'].append(len(nodes) - 1)

    while len(bin_) % 4: bin_ += b'\0'
    gl = {'asset': {'version': '2.0', 'generator': '別喝我的乳清 map exporter'},
          'scene': 0, 'scenes': [{'name': '宿舍地圖', 'nodes': [0]}], 'nodes': nodes, 'meshes': meshes,
          'materials': materials, 'accessors': accessors, 'bufferViews': bufferViews, 'buffers': [{'byteLength': len(bin_)}],
          'extensionsUsed': ['KHR_materials_unlit']}
    if images:
        gl['images'] = images; gl['textures'] = textures; gl['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
    js = json.dumps(gl, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    while len(js) % 4: js += b' '
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(OUT, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bin_)
    print('meshes', len(meshes), 'materials', len(materials), 'textures', len(textures), 'groups', list(groups), 'bytes', total)


d = asyncio.run(grab())
build(d)
