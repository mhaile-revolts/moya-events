import { useMemo } from "react";
import { T } from "../../theme.js";

function seededGrid(seedStr, size) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const grid = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) row.push(rand() > 0.56);
    grid.push(row);
  }
  return grid;
}

export default function FakeQR({ value, size = 128 }) {
  const modules = 21;
  const grid = useMemo(() => seededGrid(String(value), modules), [value]);
  const cell = size / modules;
  const finder = (x, y) => (
    <g key={`${x}-${y}`}>
      <rect x={x * cell} y={y * cell} width={cell * 7} height={cell * 7} fill={T.ink} />
      <rect x={(x + 1) * cell} y={(y + 1) * cell} width={cell * 5} height={cell * 5} fill="#fff" />
      <rect x={(x + 2) * cell} y={(y + 2) * cell} width={cell * 3} height={cell * 3} fill={T.ink} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: 8 }}>
      <rect width={size} height={size} fill="#fff" />
      {grid.map((row, r) => row.map((on, c) => {
        const inFinderZone = (r < 8 && c < 8) || (r < 8 && c > modules - 9) || (r > modules - 9 && c < 8);
        if (!on || inFinderZone) return null;
        return <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={T.ink} />;
      }))}
      {finder(0, 0)}{finder(modules - 7, 0)}{finder(0, modules - 7)}
    </svg>
  );
}
