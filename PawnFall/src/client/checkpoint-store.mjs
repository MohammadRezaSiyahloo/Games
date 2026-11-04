import { cleanCheckpoint } from '../shared/checkpoints.mjs';

export class CheckpointStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.data = {};
    try {
      const raw = JSON.parse(storage.getItem('pawnfall-checkpoints-v1') || '{}');
      for (let i = 0; i < 4; i++) {
        const c = cleanCheckpoint(raw?.[i]);
        if (c && c.chapter === i) this.data[i] = c;
      }
    } catch {}
  }

  get(chapter) {
    return cleanCheckpoint(this.data[chapter]);
  }

  save(checkpoint) {
    const c = cleanCheckpoint(checkpoint);
    if (!c) return;
    this.data[c.chapter] = c;
    this.write();
  }

  clear(chapter) {
    delete this.data[chapter];
    this.write();
  }

  write() {
    try {
      this.storage.setItem('pawnfall-checkpoints-v1', JSON.stringify(this.data));
    } catch {}
  }
}
