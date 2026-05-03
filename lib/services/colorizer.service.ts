type RGB = { r: number; g: number; b: number };

export function stringToColor(str: string, bgColor: string = '000'): string {
  const fgColor = stringToHash(str);

  return ensureContrast(fgColor, bgColor)
    ? fgColor
    : stringToColor(str + '-10102010', bgColor);
}

function stringToHash(str: string): string {
  const hash = str
    .split('')
    .reduce((hash, char) => char.charCodeAt(0) + ((hash << 9) - hash), 0);

  return [0, 1, 2].reduce(
    (color, i) =>
      color + ((hash >> (i * 8)) & 0xff).toString(16).padStart(2, '0'),
    '#',
  );
}

function ensureContrast(fgColor: string, bgColor: string): boolean {
  const fgYiq = getYIQ(hexToRgb(fgColor.slice(1)));
  const bgYiq = getYIQ(hexToRgb(bgColor));

  return Math.abs(bgYiq - fgYiq) >= 128;
}

function hexToRgb(hex: string): RGB {
  const bigint = parseInt(hex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function getYIQ({ r, g, b }: RGB): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}
