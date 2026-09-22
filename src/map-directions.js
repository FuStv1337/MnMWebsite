// World-map coordinates increase eastward (x) and southward (y).
const compass = [
  ['east', 'East', '→'], ['southeast', 'Southeast', '↘'],
  ['south', 'South', '↓'], ['southwest', 'Southwest', '↙'],
  ['west', 'West', '←'], ['northwest', 'Northwest', '↖'],
  ['north', 'North', '↑'], ['northeast', 'Northeast', '↗'],
];

export function relativeDirection(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const index = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
  const [id, label, arrow] = compass[index];
  return { id, label, arrow };
}
