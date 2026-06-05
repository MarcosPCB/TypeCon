// Build Engine sintable — 2048 entries, range -16384..+16384
// Generation matches engine.cpp lines 8662-8667
export const sintable = new Int16Array(2048);
const BANG2RAD = Math.PI * (1.0 / 1024.0);
for (let i = 0; i <= 512; i++)
  sintable[i] = Math.round(16384 * Math.sin((i * BANG2RAD)));
for (let i = 513; i < 1024; i++)
  sintable[i] = sintable[1024 - i];
for (let i = 1024; i < 2048; i++)
  sintable[i] = -sintable[i - 1024];

// mulscale(a, b, scale) = (a * b) >> scale  — requires 64-bit intermediate
export function mulscale(a: number, b: number, scale: number): number {
  return Number(BigInt(a) * BigInt(b) >> BigInt(scale)) | 0;
}

// divscale(a, b, scale) = (a << scale) / b
export function divscale(a: number, b: number, scale: number): number {
  if (b === 0) return 0;
  return Number((BigInt(a) << BigInt(scale)) / BigInt(b)) | 0;
}

export function buildSqrt(n: number): number {
  return Math.floor(Math.sqrt(Math.max(0, n)));
}
