export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const parsed = hex.replace(/^#/, '');
  if (parsed.length !== 6) return null;
  return {
    r: parseInt(parsed.slice(0, 2), 16),
    g: parseInt(parsed.slice(2, 4), 16),
    b: parseInt(parsed.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) {
    [rp, gp, bp] = [c, x, 0];
  } else if (h < 120) {
    [rp, gp, bp] = [x, c, 0];
  } else if (h < 180) {
    [rp, gp, bp] = [0, c, x];
  } else if (h < 240) {
    [rp, gp, bp] = [0, x, c];
  } else if (h < 300) {
    [rp, gp, bp] = [x, 0, c];
  } else {
    [rp, gp, bp] = [c, 0, x];
  }
  return [(rp + m) * 255, (gp + m) * 255, (bp + m) * 255];
}

/**
 * Lightens a hex color by blending with white.
 * @param hex e.g. '#1B4D7A'
 * @param amount 0–1; 0.5 = 50% mix with white
 */
export function lightenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const nr = Math.round(rgb.r + (255 - rgb.r) * amount);
  const ng = Math.round(rgb.g + (255 - rgb.g) * amount);
  const nb = Math.round(rgb.b + (255 - rgb.b) * amount);
  return rgbToHex(nr, ng, nb);
}

/** Shift hue in degrees; optionally boost saturation for a richer gradient stop. */
export function shiftHueSaturateHex(hex: string, hueDelta: number, saturationBoost = 1.15): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b);
  h = (h + hueDelta + 360) % 360;
  s = Math.min(1, s * saturationBoost);
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(255,255,255,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}
