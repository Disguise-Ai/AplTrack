// Simple event emitter for triggering data refresh across the app
type RefreshCallback = () => void;

const listeners: Set<RefreshCallback> = new Set();

export function onRefreshTriggered(callback: RefreshCallback): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

export function triggerRefresh() {
  listeners.forEach(callback => callback());
}
