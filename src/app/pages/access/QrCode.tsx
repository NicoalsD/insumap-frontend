import { useMemo } from 'react';
import { qrModules } from './qrModules';

/** Light border of modules around the code, as the QR standard asks (4 modules). */
const QUIET_ZONE = 4;
const SIDES = 2;

/** Builds the SVG path of the dark modules; one path keeps the markup small. */
function modulesPath(modules: readonly (readonly boolean[])[]): string {
  return modules
    .flatMap((row, r) =>
      row.flatMap((dark, c) => (dark ? [`M${String(c + QUIET_ZONE)} ${String(r + QUIET_ZONE)}h1v1h-1z`] : [])),
    )
    .join('');
}

export interface QrCodeProps {
  value: string;
  label: string;
}

/**
 * QR code drawn as React SVG (no HTML injection). It is one image for assistive technology: the
 * text alternative is `label`, and the same secret is offered as copyable text next to it.
 */
export function QrCode({ value, label }: QrCodeProps) {
  const modules = useMemo(() => qrModules(value), [value]);
  const size = modules.length + QUIET_ZONE * SIDES;
  return (
    <svg
      className="access__qr"
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} />
      <path d={modulesPath(modules)} />
    </svg>
  );
}
