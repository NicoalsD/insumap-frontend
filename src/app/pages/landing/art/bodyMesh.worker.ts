import { buildBodyMesh } from './bodySdf';

/** Meshes the body off the main thread and hands the buffers back without copying them. */
const scope = globalThis as unknown as {
  postMessage: (message: unknown, transfer: Transferable[]) => void;
};

const mesh = buildBodyMesh(0.02);
scope.postMessage(mesh, [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer]);
