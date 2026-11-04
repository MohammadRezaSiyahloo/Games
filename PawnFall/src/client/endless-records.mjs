const difficulties = ['pilgrim', 'standard', 'veteran', 'nightmare'];

export class EndlessRecords {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.records = {};
    this.legacy = 0;
    try {
      const raw = JSON.parse(storage.getItem('pawnfall-endless-records-v2') || '{}');
      for (const id of difficulties) {
        const row = raw[id];
        if (Number.isInteger(row?.cleared) && row.cleared >= 0 && row.cleared < 1e9)
          this.records[id] = {
            cleared: row.cleared,
            seconds: Math.max(0, Number(row.seconds) || 0),
          };
      }
      const old = Number(storage.getItem('pawnfall-endless-best-v1'));
      if (Number.isFinite(old) && old > 0) this.legacy = Math.floor(old);
    } catch {}
  }

  best(id) {
    return this.records[id]?.cleared || 0;
  }

  record(id, cleared, seconds = 0) {
    if (
      !difficulties.includes(id) ||
      !Number.isInteger(cleared) ||
      cleared <= this.best(id) ||
      cleared >= 1e9
    )
      return false;
    this.records[id] = { cleared, seconds: Math.max(0, Number(seconds) || 0) };
    try {
      this.storage.setItem('pawnfall-endless-records-v2', JSON.stringify(this.records));
    } catch {}
    return true;
  }

  rows() {
    return difficulties.map((id) => ({ id, cleared: this.best(id) }));
  }
}
