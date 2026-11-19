"""Builds public/models/makehuman-body.bin from the CC0 MakeHuman base mesh and targets.

Usage (downloads are data only; nothing from them is executed):

    python3 -P scripts/makehuman/build_body.py --data DIR --out public/models/makehuman-body.bin

DIR holds files fetched from makehumancommunity/makehuman at the commit in SOURCE_COMMIT:
  makehuman/data/3dobjs/base.obj
  makehuman/data/targets/macrodetails/{african,asian,caucasian}-{female,male}-young.target
  makehuman/data/targets/macrodetails/universal-{female,male}-young-averagemuscle-{maxweight,minweight}.target
  makehuman/data/targets/macrodetails/proportions/{female,male}-young-averagemuscle-averageweight-idealproportions.target

Output: one binary file. A little-endian u32 with the header length, the UTF-8 JSON header, zero
padding to 4 bytes, then the arrays the header describes (offsets relative to the data start):
  - base: float32 positions of the female body (x, y, z per vertex)
  - indices: uint16 triangle indices
  - deltas: int16 position deltas, each with its own scale (value = int * scale):
      male (male minus female), female_max_weight, female_min_weight, male_max_weight, male_min_weight
  - anchors: per injection site, the 4 vertex indices of its spots (same topology for every body)

Frame (the one of src/app/pages/landing/art/bodySdf.ts): soles at y = -2, the taller body 4 units
high, the face toward +z, the patient's left on +x.
"""

import argparse
import json
import struct

import numpy as np

SOURCE_REPO = 'https://github.com/makehumancommunity/makehuman'
SOURCE_COMMIT = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
ETHNICS = ('african', 'asian', 'caucasian')
FRAME_HEIGHT = 4.0
FRAME_FLOOR = -2.0
# MakeHuman's "body proportions" slider at 0.75 (0.5 is neutral, 1 is ideal).
IDEAL_PROPORTIONS = 0.5
KEPT_GROUPS = ('body', 'helper-l-eye', 'helper-r-eye')

# Injection regions, for the patient's left (+x). Heights are shares of the body height from the
# soles; the direction is the outward face the site is injected through (x, y, z).
REGIONS = {
    # Lower abdomen beside the navel, at least 5 cm from it (height: see NAVEL_DROP).
    'ABDOMEN': {'height': None, 'x': 0.17, 'face': (0.25, 0.0, 1.0)},
    # Anterior-outer thigh, middle third.
    'THIGH': {'height': 0.39, 'x': None, 'face': (0.6, 0.0, 0.8)},
    # Posterior-outer upper arm, mid upper arm.
    'ARM': {'height': 0.715, 'x': None, 'face': (0.75, 0.0, -0.65)},
    # Upper outer quadrant of the buttock.
    'BUTTOCK': {'height': 0.525, 'x': 0.15, 'face': (0.55, 0.15, -0.82)},
}
# Half spacing between spot centers, in frame units (1 unit is about 42 cm).
HALF_SPACING = {'ABDOMEN': (0.06, 0.06), 'THIGH': (0.06, 0.06), 'ARM': (0.035, 0.06), 'BUTTOCK': (0.06, 0.06)}
# Spot grid as src/ui/body/injectionRays.ts: (column, row).
SPOT_GRID = ((-1, 1), (1, 1), (-1, -1), (1, -1))
# The abdomen spots sit a little below the navel, in frame units (1 unit is about 42 cm).
NAVEL_DROP = 0.04
# Right spots mirror the left ones with columns swapped, so spot 1 is top-left on screen on both sides.
MIRROR_SPOT = (1, 0, 3, 2)


def read_obj(path):
    vertices, faces, group = [], {}, None
    with open(path, encoding='utf-8') as handle:
        for line in handle:
            if line.startswith('v '):
                vertices.append([float(value) for value in line.split()[1:4]])
            elif line.startswith('g '):
                group = line.split()[1]
            elif line.startswith('f '):
                faces.setdefault(group, []).append([int(token.split('/')[0]) - 1 for token in line.split()[1:]])
    return np.array(vertices, dtype=np.float64), faces


def read_target(path, count):
    delta = np.zeros((count, 3), dtype=np.float64)
    with open(path, encoding='utf-8') as handle:
        for line in handle:
            if not line.strip() or line.startswith('#'):
                continue
            index, dx, dy, dz = line.split()
            delta[int(index)] = (float(dx), float(dy), float(dz))
    return delta


def vertex_normals(positions, triangles):
    normals = np.zeros_like(positions)
    a, b, c = positions[triangles[:, 0]], positions[triangles[:, 1]], positions[triangles[:, 2]]
    face = np.cross(b - a, c - a)
    for corner in range(3):
        np.add.at(normals, triangles[:, corner], face)
    length = np.linalg.norm(normals, axis=1, keepdims=True)
    return normals / np.maximum(length, 1e-12)


def unit(vector):
    vector = np.asarray(vector, dtype=np.float64)
    return vector / np.linalg.norm(vector)


def pick(positions, normals, target, face, radius):
    """Vertex nearest to `target` whose normal faces `face`, within `radius`."""
    distance = np.linalg.norm(positions - target, axis=1)
    facing = normals @ face
    score = distance - 0.02 * facing
    score[(distance > radius) | (facing < 0.35)] = np.inf
    best = int(np.argmin(score))
    if not np.isfinite(score[best]):
        raise SystemExit(f'no vertex near {target}')
    return best


def navel_height(positions):
    """The navel: the deepest point of the front midline between the chest and the pubis."""
    top = positions[:, 1].max()
    span = top - FRAME_FLOOR
    midline = np.where(
        (np.abs(positions[:, 0]) < 0.012)
        & (positions[:, 1] > FRAME_FLOOR + 0.52 * span)
        & (positions[:, 1] < FRAME_FLOOR + 0.66 * span)
        & (positions[:, 2] > 0)
    )[0]
    order = midline[np.argsort(positions[midline, 1])]
    z = positions[order, 2]
    # Local minimum of z along the midline, after a light smoothing of the profile.
    smooth = np.convolve(z, np.ones(3) / 3, mode='same')
    inner = np.arange(1, len(order) - 1)
    dips = inner[(smooth[inner] < smooth[inner - 1]) & (smooth[inner] < smooth[inner + 1])]
    best = dips[np.argmin(smooth[dips])] if len(dips) else int(np.argmin(z))
    return float(positions[order[best], 1])


def region_center(positions, normals, region, side):
    spec = REGIONS[region]
    face = unit((spec['face'][0] * side, spec['face'][1], spec['face'][2]))
    if spec['height'] is None:
        height = navel_height(positions) - NAVEL_DROP
    else:
        height = FRAME_FLOOR + spec['height'] * (positions[:, 1].max() - FRAME_FLOOR)
    band = np.abs(positions[:, 1] - height) < 0.03
    sided = positions[:, 0] * side > 0.02
    candidates = np.where(band & sided)[0]
    if region in ('THIGH', 'ARM'):
        # The limb's own cross-section: thigh between the crotch and the hand, arm outside the torso.
        xs = positions[candidates, 0] * side
        limb = candidates[(xs > 0.55)] if region == 'ARM' else candidates[(xs < 0.42)]
        center = positions[limb].mean(axis=0)
        # The outermost point of the limb along the face direction.
        offsets = (positions[limb] - center) @ face
        return int(limb[int(np.argmax(offsets))]), face
    x = spec['x'] * side
    target = np.array([x, height, 0.0])
    # Front or back surface along z: the extreme vertex near (x, height).
    near = candidates[np.abs(positions[candidates, 0] - x) < 0.03]
    z = positions[near, 2] * np.sign(face[2])
    index = int(near[int(np.argmax(z))])
    target[2] = positions[index, 2]
    return pick(positions, normals, target, face, 0.08), face


def mirror_vertex(positions, index):
    """The vertex at the mirror image of `index` across the sagittal plane (the mesh is symmetric)."""
    target = positions[index] * [-1.0, 1.0, 1.0]
    nearest = int(np.argmin(np.linalg.norm(positions - target, axis=1)))
    if np.linalg.norm(positions[nearest] - target) > 1e-3:
        raise SystemExit(f'vertex {index} has no mirror')
    return nearest


def site_spots(positions, normals, region, side):
    center, face = region_center(positions, normals, region, side)
    normal = unit(normals[center] * 0.5 + face * 0.5)
    first = unit(np.cross([0.0, 1.0, 0.0], normal))
    second = unit(np.cross(normal, first))
    across, up = HALF_SPACING[region]
    spots = []
    for column, row in SPOT_GRID:
        target = positions[center] + first * column * across + second * row * up
        spots.append(pick(positions, normals, target, normal, 0.06))
    return spots


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()

    vertices, faces = read_obj(f'{args.data}/base.obj')
    count = len(vertices)
    target = lambda name: read_target(f'{args.data}/{name}.target', count)  # noqa: E731

    sex = {}
    for gender in ('female', 'male'):
        ethnic = sum(target(f'{ethnic}-{gender}-young') for ethnic in ETHNICS) / len(ETHNICS)
        ideal = target(f'{gender}-young-averagemuscle-averageweight-idealproportions')
        sex[gender] = vertices + ethnic + IDEAL_PROPORTIONS * ideal
    weight = {
        (gender, bound): target(f'universal-{gender}-young-averagemuscle-{bound}weight')
        for gender in ('female', 'male')
        for bound in ('max', 'min')
    }

    quads = [face for group in KEPT_GROUPS for face in faces[group]]
    used = np.unique(np.array(quads).ravel())
    remap = np.full(count, -1, dtype=np.int64)
    remap[used] = np.arange(len(used))
    triangles = []
    for face in quads:
        for k in range(1, len(face) - 1):
            triangles.append((remap[face[0]], remap[face[k]], remap[face[k + 1]]))
    triangles = np.array(triangles, dtype=np.int64)

    # One transform for both bodies: the taller one is FRAME_HEIGHT high, soles on FRAME_FLOOR.
    floor = min(sex['female'][used, 1].min(), sex['male'][used, 1].min())
    top = max(sex['female'][used, 1].max(), sex['male'][used, 1].max())
    scale = FRAME_HEIGHT / (top - floor)
    frame = lambda points: (points[used] - [0.0, floor, 0.0]) * scale + [0.0, FRAME_FLOOR, 0.0]  # noqa: E731
    female = frame(sex['female'])
    male = frame(sex['male'])
    deltas = {
        'male': male - female,
        'female_max_weight': weight[('female', 'max')][used] * scale,
        'female_min_weight': weight[('female', 'min')][used] * scale,
        'male_max_weight': weight[('male', 'max')][used] * scale,
        'male_min_weight': weight[('male', 'min')][used] * scale,
    }

    # Anchors on the neutral body (halfway between female and male): the same vertices serve both.
    neutral = female + 0.5 * deltas['male']
    body_triangles = triangles[: sum(len(faces['body'][i]) - 2 for i in range(len(faces['body'])))]
    normals = vertex_normals(neutral, body_triangles)
    anchors = {}
    for region in REGIONS:
        left = site_spots(neutral, normals, region, 1)
        mirrored = [mirror_vertex(neutral, index) for index in left]
        anchors[f'{region}_LEFT'] = left
        anchors[f'{region}_RIGHT'] = [mirrored[k] for k in MIRROR_SPOT]
    print('navel y', round(navel_height(neutral), 3), 'width', round(float(np.abs(neutral[:, 0]).max()), 3),
          'female top', round(float(female[:, 1].max()), 3))

    arrays = bytearray()
    layout = {}

    def push(name, data, kind, extra=None):
        while len(arrays) % 4:
            arrays.append(0)
        layout[name] = {'offset': len(arrays), 'length': int(data.size), 'type': kind, **(extra or {})}
        arrays.extend(data.tobytes())

    push('base', female.astype('<f4').ravel(), 'f32')
    push('indices', triangles.astype('<u2').ravel(), 'u16')
    targets = []
    for name, delta in deltas.items():
        step = max(float(np.abs(delta).max()), 1e-9) / 32767.0
        quantized = np.round(delta / step).astype('<i2').ravel()
        push(f'delta:{name}', quantized, 'i16', {'scale': step})
        targets.append(name)

    header = {
        'format': 'insumap-body/1',
        'source': {'repo': SOURCE_REPO, 'commit': SOURCE_COMMIT, 'license': 'CC0-1.0'},
        'vertexCount': int(len(used)),
        'indexCount': int(triangles.size),
        'frame': {'height': FRAME_HEIGHT, 'floor': FRAME_FLOOR, 'facing': '+z', 'patientLeft': '+x'},
        'targets': targets,
        'arrays': layout,
        'anchors': anchors,
    }
    encoded = json.dumps(header, separators=(',', ':')).encode('utf-8')
    encoded += b' ' * ((4 - (len(encoded) + 4) % 4) % 4)
    with open(args.out, 'wb') as out:
        out.write(struct.pack('<I', len(encoded)))
        out.write(encoded)
        out.write(arrays)
    print(f"{args.out}: {len(used)} vertices, {len(triangles)} triangles, {4 + len(encoded) + len(arrays)} bytes")
    for site, spots in anchors.items():
        center = neutral[spots].mean(axis=0)
        print(site, tuple(round(float(v), 3) for v in center), [tuple(round(float(v), 2) for v in neutral[i]) for i in spots])


if __name__ == '__main__':
    main()
