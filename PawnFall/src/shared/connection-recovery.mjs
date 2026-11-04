export const COOP_RECONNECT_MS = 45000;

export function connectionRecovery(mode, seen, now) {
  const limit = mode === 'coop' ? COOP_RECONNECT_MS : 12000;
  const ages = seen.map((t) => Math.max(0, now - (Number(t) || 0)));
  const expired = ages.findIndex((age) => age > limit);
  const missing = mode === 'coop' ? ages.findIndex((age) => age > 2500) : -1;
  return {
    expired,
    reconnecting: mode === 'coop' && missing >= 0 && expired < 0,
    reconnectSeat: missing,
    reconnectRemainingMs: missing >= 0 ? Math.max(0, limit - ages[missing]) : 0,
  };
}
