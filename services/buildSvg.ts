// drawSvg.ts
// Returns an SVG string for a knot diagram from orthogonal projection data.
// Usage: container.innerHTML = drawSvg(geometry);

import type { Geometry, NumPair } from "./types";

// ── geometry helpers ──────────────────────────────────────────────────────

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

  // Precompute crossing points in SVG coords from the geometry-space
  // crossing_x / crossing_y carried in each CrossingSpec.
  // CrossingSpec = [crossing_id, under_line, over_line, crossing_x, crossing_y]
  const crossingPoints = new Map<number, NumPair>();
  for (const [crossing_id, _under, _over, crossing_x, crossing_y] of crossing_specs) {
    crossingPoints.set(crossing_id, toSvg([crossing_x, crossing_y]));
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

    // ── Twist crossing ────────────────────────────────────────────────────
    if (under_line === null || over_line === null) {
      const strandIdx = (under_line ?? over_line) as number;
      const handedness = under_line === null ? "right" : "left";
 
      const ss = svgVerts[arrows[strandIdx][0]];
      const se = svgVerts[arrows[strandIdx][1]];
      const isH = segmentDirection(ss, se) === "horizontal";
 
      // right-handed: loop bulges in positive perp direction (down for H, right for V)
      // left-handed:  loop bulges in negative perp direction (up for H, left for V)
      const sign = handedness === "right" ? 1 : -1;
 
      // Loop geometry. REACH is how far along the strand the loop extends before
      // re-crossing. BULGE is how far it extends perpendicularly. The re-crossing
      // happens at (REACH, 0) in loop-local coords — i.e. back on the strand axis.
      const BULGE = 48;
      const REACH = 36;
      const GAP   = 20; // half-width of the eraser at the re-crossing
      const TAIL  =  8; // how far past the re-crossing the loop tail extends
 
      // Map loop-local (along, perp) → SVG (x, y)
      const pt = (along: number, perp: number): NumPair =>
        isH
          ? [cx + along, cy + sign * perp]
          : [cx + sign * perp, cy + along];
 
      const fmt = ([x, y]: NumPair) => `${x.toFixed(1)},${y.toFixed(1)}`;
 
      const A    = pt(0,             0);           // loop root on main strand
      const B    = pt(REACH,         BULGE);       // far tip of loop
      const T    = pt(REACH + TAIL,  0);           // tail end, just past re-crossing
      const cp1  = pt(REACH * 0.4,   0);           // A departs along the strand
      const cp2  = pt(REACH,         BULGE * 0.3); // arrives at B from below
      const cp3  = pt(REACH,         BULGE * 0.3); // departs B back toward strand
      const cp4  = pt(REACH + TAIL,  0);           // arrives at T along strand
 
      // Layer 1 — outgoing arc: A → B
      lines.push(
        `<path d="M ${fmt(A)} C ${fmt(cp1)},${fmt(cp2)},${fmt(B)}" `
        + `fill="none" stroke="#1f4f82" stroke-width="${STROKE}" stroke-linecap="round"/>`,
      );
 
      // Layer 1 — return arc: B → T (will be partially erased at re-crossing)
      lines.push(
        `<path d="M ${fmt(B)} C ${fmt(cp3)},${fmt(cp4)},${fmt(T)}" `
        + `fill="none" stroke="#1f4f82" stroke-width="${STROKE}" stroke-linecap="round"/>`,
      );
 
      // Layer 2 — erase the under-strand at the re-crossing point
      const gS = pt(REACH - GAP, 0);
      const gE = pt(REACH + GAP, 0);
      lines.push(
        `<line x1="${gS[0].toFixed(1)}" y1="${gS[1].toFixed(1)}" `
        + `x2="${gE[0].toFixed(1)}" y2="${gE[1].toFixed(1)}" `
        + `stroke="#fafafa" stroke-width="${GAP_STROKE}" stroke-linecap="round"/>`,
      );
 
      // Layer 3 — repaint the over-strand on top
      if (handedness === "right") {
        // Return arc is on top — repaint its tail from just before the re-crossing
        const rS = pt(REACH - GAP * 0.5, BULGE * 0.06);
        lines.push(
          `<path d="M ${fmt(rS)} C ${fmt(cp4)},${fmt(cp4)},${fmt(T)}" `
          + `fill="none" stroke="#1f4f82" stroke-width="${STROKE}" stroke-linecap="round"/>`,
        );
      } else {
        // Main strand is on top — repaint it straight across the re-crossing
        lines.push(
          `<line x1="${gS[0].toFixed(1)}" y1="${gS[1].toFixed(1)}" `
          + `x2="${gE[0].toFixed(1)}" y2="${gE[1].toFixed(1)}" `
          + `stroke="#1f4f82" stroke-width="${STROKE}" stroke-linecap="round"/>`,
        );
      }
 
      // Crossing label
      lines.push(
        `<text x="${(cx + 16).toFixed(1)}" y="${(cy - 16).toFixed(1)}" `
        + `text-anchor="middle" dominant-baseline="central" `
        + `font-size="${FONT + 4}" font-weight="bold" `
        + `fill="#f0c040" stroke="#fafafa" stroke-width="3" paint-order="stroke">`
        + `C${crossing_id}</text>`,
      );
      continue;
    }

    // ── Regular crossing ────────────────────────────────────────────────
    const us = svgVerts[arrows[under_line][0]], ue = svgVerts[arrows[under_line][1]];
    const os = svgVerts[arrows[over_line][0]],  oe = svgVerts[arrows[over_line][1]];

    const underIsH = segmentDirection(us, ue) === "horizontal";
    const gap: [number, number, number, number] = underIsH
      ? [cx - GAP_HALF, cy, cx + GAP_HALF, cy]
      : [cx, cy - GAP_HALF, cx, cy + GAP_HALF];

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

    // Orientation arrows on both strands
    for (const [s, e] of [[us, ue], [os, oe]] as [NumPair, NumPair][]) {
      const dx = e[0] - s[0], dy = e[1] - s[1];
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const ex = cx + GAP_HALF * ux;
      const ey = cy + GAP_HALF * uy;
      lines.push(orientationArrowSvg(ex, ey, dx, dy));
    }
  }

  lines.push("</svg>");
  return lines.join("\n");
}

export const drawSvg = buildSvg;