import { relativeDirection } from './map-directions.js';

/** Lay out nodes in image coordinates so the image, lines and nodes share a camera. */
export function layoutMapConnections(zone, destinations, width, height) {
  const unit = Math.max(width, height) / 1100;
  const nodeWidth = 260 * unit, nodeHeight = 140 * unit, gap = 90 * unit;
  const groups = new Map();
  for (const destination of destinations) {
    const direction = relativeDirection(zone, destination);
    if (!groups.has(direction.id)) groups.set(direction.id, []);
    groups.get(direction.id).push({ destination, direction });
  }
  const nodes = [];
  for (const [id, group] of groups) {
    const dx = id.includes('east') ? 1 : id.includes('west') ? -1 : 0;
    const dy = id.includes('south') ? 1 : id.includes('north') ? -1 : 0;
    group.forEach((entry, index) => {
      const fraction = (index + 1) / (group.length + 1);
      const anchorX = dx ? (dx > 0 ? width : 0) : width * fraction;
      const anchorY = dy ? (dy > 0 ? height : 0) : height * fraction;
      let cx = anchorX + dx * (gap + nodeWidth / 2);
      let cy = anchorY + dy * (gap + nodeHeight / 2);
      // Separate multiple nodes sharing a corner, keeping every node outside the image.
      if (dx && dy) cy += dy * index * (nodeHeight + 24 * unit);
      const vx = anchorX - cx, vy = anchorY - cy;
      const t = Math.min(vx ? nodeWidth / 2 / Math.abs(vx) : Infinity, vy ? nodeHeight / 2 / Math.abs(vy) : Infinity);
      nodes.push({ ...entry, x: cx - nodeWidth / 2, y: cy - nodeHeight / 2,
        width: nodeWidth, height: nodeHeight, anchorX, anchorY,
        endX: cx + vx * t, endY: cy + vy * t });
    });
  }
  const x = Math.min(0, ...nodes.map(n => n.x));
  const y = Math.min(0, ...nodes.map(n => n.y));
  return { unit, nodes, bounds: { x, y,
    width: Math.max(width, ...nodes.map(n => n.x + n.width)) - x,
    height: Math.max(height, ...nodes.map(n => n.y + n.height)) - y } };
}
