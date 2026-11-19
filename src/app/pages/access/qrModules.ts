import qrcode from 'qrcode-generator';

/** Dark-module matrix of `value`, built in the browser. The value never leaves the page. */
export function qrModules(value: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  return Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, col) => qr.isDark(row, col)),
  );
}
