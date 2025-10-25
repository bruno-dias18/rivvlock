// Lightweight shim for lodash/get to avoid ESM default export issues
// Supports dot and bracket notation (e.g., "a.b[0].c") with a sensible default

export type Path = string | Array<string | number>;

function toPathArray(path: Path): Array<string | number> {
  if (Array.isArray(path)) return path;
  return path
    .replace(/\[(\d+)\]/g, ".$1") // convert [0] to .0
    .split(".")
    .filter(Boolean)
    .map((seg) => (seg.match(/^\d+$/) ? Number(seg) : seg));
}

function get<T extends object, D = any>(obj: T | null | undefined, path: Path, defaultValue?: D): any {
  if (obj == null) return defaultValue;
  const segments = toPathArray(path);
  let current: any = obj;
  for (const key of segments) {
    if (current == null) return defaultValue;
    current = current[key as any];
  }
  return current === undefined ? defaultValue : current;
}

export default get;
