// One visible event at a time. Drop stale chatter instead of building a backlog.
export class NoticeGate {
  constructor() { this.reset(); }
  reset() {
    this.until = 0;
    this.priority = -1;
    this.recent = new Map();
  }
  accept(text, now, { priority = 1, duration = 2.2 } = {}) {
    if (!text || !Number.isFinite(now)) return false;
    if (now < this.until && priority <= this.priority) return false;
    if (now - (this.recent.get(text) ?? -Infinity) < 6) return false;
    this.until = now + duration;
    this.priority = priority;
    this.recent.set(text, now);
    if (this.recent.size > 40) this.recent.delete(this.recent.keys().next().value);
    return true;
  }
}
