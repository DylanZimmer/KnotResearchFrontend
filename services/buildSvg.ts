// drawSvg.ts
// Returns an SVG string for a knot diagram from orthogonal projection data.
// Usage: container.innerHTML = drawSvg(geometry);

import type { Geometry, NumPair } from "./types";

// ── geometry helpers ──────────────────────────────────────────────────────

function segmentIntersection(
  startA: NumPair, endA: NumPair,
  startB: NumPair, endB: NumPair,
): NumPair {
  const aVertical = startA[0] === endA[0];
  const bVertical = startB[0] === endB[0];
  if (aVertical === bVertical) throw new Error("Segments must be perpendicular");
  if (aVertical) return [startA[0], startB[1]];
  return [startB[0], startA[1]];
}

function segmentDirection(start: NumPair, end: NumPair): "horizontal" | "vertical" {
  return start[0] === end[0] ? "vertical" : "horizontal";
}

function orientationArrowSvg(
  cx: number, cy: number,
  dx: number, dy: number,
  size = 6,
  color = "#e05252",
): string {
  const s = size;
  let pts: string;
  if (Math.abs(dx) >= Math.abs(dy)) {
    pts = dx >= 0
      ? `${cx - s},${cy - s} ${cx + s},${cy} ${cx - s},${cy + s}`
      : `${cx + s},${cy - s} ${cx - s},${cy} ${cx + s},${cy + s}`;
  } else {
    pts = dy >= 0
      ? `${cx - s},${cy - s} ${cx},${cy + s} ${cx + s},${cy - s}`
      : `${cx - s},${cy + s} ${cx},${cy - s} ${cx + s},${cy + s}`;
  }
  return `<polygon points="${pts}" fill="${color}"/>`;
}

// ── main export ───────────────────────────────────────────────────────────

export function buildSvg({ vertex_positions, arrows, crossing_specs }: Geometry): string {
  const W = 500, H = 500, MARGIN = 60, STROKE = 10;
  const GAP_STROKE = 18, GAP_HALF = 18, FONT = 13;
  const INNER_W = W - 2 * MARGIN, INNER_H = H - 2 * MARGIN;

  // Fit diagram into canvas
  const xs = vertex_positions.map(p => p[0]);
  const ys = vertex_positions.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
  const scale = Math.min(INNER_W / spanX, INNER_H / spanY);
  const offX = MARGIN + (INNER_W - spanX * scale) / 2;
  const offY = MARGIN + (INNER_H - spanY * scale) / 2;

  const toSvg = ([x, y]: NumPair): NumPair => [
    offX + (x - minX) * scale,
    offY + (maxY - y) * scale,
  ];

  const svgVerts = vertex_positions.map(toSvg);

  // Precompute crossing intersection points keyed by crossing_id
  // CrossingSpec = [crossing_id, under_line, over_line]
  const crossingPoints = new Map<number, NumPair>();
  for (const [crossing_id, under_line, over_line] of crossing_specs) {
    crossingPoints.set(crossing_id, segmentIntersection(
      svgVerts[arrows[under_line][0]], svgVerts[arrows[under_line][1]],
      svgVerts[arrows[over_line][0]],  svgVerts[arrows[over_line][1]],
    ));
  }

  const lines: string[] = [];

  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" `
    + `viewBox="0 0 ${W} ${H}" style="background:#fafafa;font-family:monospace;">`,
  );

  // Base strands
  for (const [si, ei] of arrows) {
    const [x1, y1] = svgVerts[si];
    const [x2, y2] = svgVerts[ei];
    lines.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" `
      + `x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" `
      + `stroke="#1f4f82" stroke-width="${STROKE}" stroke-linecap="round"/>`,
    );
  }

  // Crossings
  for (const [crossing_id, under_line, over_line] of crossing_specs) {
    const [cx, cy] = crossingPoints.get(crossing_id)!;

    const us = svgVerts[arrows[under_line][0]], ue = svgVerts[arrows[under_line][1]];
    const os = svgVerts[arrows[over_line][0]],  oe = svgVerts[arrows[over_line][1]];

    // Erase under-strand through the crossing
    const underIsH = segmentDirection(us, ue) === "horizontal";
    const gap: [number, number, number, number] = underIsH
      ? [cx - GAP_HALF, cy, cx + GAP_HALF, cy]
      : [cx, cy - GAP_HALF, cx, cy + GAP_HALF];

    // Repaint over-strand on top
    const overIsH = segmentDirection(os, oe) === "horizontal";
    const patch: [number, number, number, number] = overIsH
      ? [cx - GAP_HALF, cy, cx + GAP_HALF, cy]
      : [cx, cy - GAP_HALF, cx, cy + GAP_HALF];

    lines.push(
      `<line x1="${gap[0].toFixed(1)}" y1="${gap[1].toFixed(1)}" `
      + `x2="${gap[2].toFixed(1)}" y2="${gap[3].toFixed(1)}" `
      + `stroke="#fafafa" stroke-width="${GAP_STROKE}" stroke-linecap="round"/>`,
    );
    lines.push(
      `<line x1="${patch[0].toFixed(1)}" y1="${patch[1].toFixed(1)}" `
      + `x2="${patch[2].toFixed(1)}" y2="${patch[3].toFixed(1)}" `
      + `stroke="#1f4f82" stroke-width="${STROKE}" stroke-linecap="round"/>`,
    );

    // Crossing label
    lines.push(
      `<text x="${(cx + 16).toFixed(1)}" y="${(cy - 16).toFixed(1)}" `
      + `text-anchor="middle" dominant-baseline="central" `
      + `font-size="${FONT + 4}" font-weight="bold" `
      + `fill="#f0c040" stroke="#fafafa" stroke-width="3" paint-order="stroke">`
      + `C${crossing_id}</text>`,
    );

    // Orientation arrows + arc labels on both strands
    for (const [s, e] of [[us, ue], [os, oe]] as [NumPair, NumPair][]) {
      const dx = e[0] - s[0], dy = e[1] - s[1];
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const ex = cx + GAP_HALF * ux;
      const ey = cy + GAP_HALF * uy;

      lines.push(orientationArrowSvg(ex, ey, dx, dy));

      const lx = ex + ux * 16, ly = ey + uy * 16;
      const arcLabel = Math.abs(dx) >= Math.abs(dy) ? 2 * crossing_id : 2 * crossing_id + 1;
      lines.push(
        `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" `
        + `text-anchor="middle" dominant-baseline="central" `
        + `font-size="${FONT}" font-weight="bold" `
        + `fill="#333" stroke="#fafafa" stroke-width="2" paint-order="stroke">`
        + `${arcLabel}</text>`,
      );
    }
  }

  lines.push("</svg>");
  return lines.join("\n");
}

export const drawSvg = buildSvg;
