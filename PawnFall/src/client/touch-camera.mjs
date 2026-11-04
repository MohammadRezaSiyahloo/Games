// Touch gestures are isolated from legacy mouse compatibility events and combat buttons.
export function bindTouchCamera(
  surface,
  { active, focus, orbit, zoom = () => {}, now = () => performance.now() },
) {
  const points = new Map();
  let last = null,
    pinch = 0,
    lastTouch = -Infinity;
  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation?.();
  };
  const rebase = () => {
    last = points.size === 1 ? { ...points.values().next().value } : null;
    const p = [...points.values()];
    pinch = p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
  };
  const down = (e) => {
    if (e.pointerType !== 'touch') return false;
    lastTouch = now();
    if (!active()) return true;
    stop(e);
    focus();
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    surface.setPointerCapture?.(e.pointerId);
    rebase();
    return true;
  };
  const move = (e) => {
    if (!points.has(e.pointerId)) return;
    stop(e);
    lastTouch = now();
    if (!active()) {
      clear();
      return;
    }
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...points.values()];
    if (p.length === 1 && last) {
      const dx = p[0].x - last.x,
        dy = p[0].y - last.y;
      if (Math.hypot(dx, dy) > 1)
        orbit(Math.max(-70, Math.min(70, dx)), Math.max(-70, Math.min(70, dy)));
      last = { ...p[0] };
    } else if (p.length === 2) {
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (pinch > 12 && d > 12) zoom(Math.max(0.8, Math.min(1.25, pinch / d)));
      pinch = d;
    }
  };
  const up = (e) => {
    if (!points.has(e.pointerId)) return false;
    stop(e);
    lastTouch = now();
    points.delete(e.pointerId);
    rebase();
    return true;
  };

  function clear() {
    points.clear();
    last = null;
    pinch = 0;
  }

  return {
    down,
    move,
    up,
    clear,
    get recentlyTouched() {
      return now() - lastTouch < 800;
    },
    get touching() {
      return points.size > 0;
    },
  };
}
