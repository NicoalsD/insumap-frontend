import { buildBodyMesh, type BodyMeshData } from './bodySdf';

let pending: Promise<BodyMeshData> | null = null;

/**
 * The body mesh, built once per page in a worker (main-thread fallback when workers are not
 * available) and shared by every scene that shows the body.
 */
export function loadBodyMesh(): Promise<BodyMeshData> {
  pending ??= new Promise<BodyMeshData>((resolve) => {
    const fallback = () => {
      resolve(buildBodyMesh(0.02));
    };
    try {
      const worker = new Worker(new URL('./bodyMesh.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<BodyMeshData>) => {
        resolve(event.data);
        worker.terminate();
      };
      worker.onerror = () => {
        worker.terminate();
        fallback();
      };
    } catch {
      fallback();
    }
  });
  return pending;
}
