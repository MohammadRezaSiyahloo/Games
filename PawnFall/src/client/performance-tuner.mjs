export class PerformanceTuner {
  constructor(preferences) {
    this.preferences = preferences;
    this.reset(false);
  }

  reset(save = true) {
    this.samples = [];
    this.warmup = 30;
    if (save) this.preferences.set({ qualityMode: 'auto', performanceCalibrated: false });
  }

  sample(ms, { active = true, coarse = false, width = 1280 } = {}) {
    const p = this.preferences.data;
    if (
      p.qualityMode !== 'auto' ||
      p.performanceCalibrated ||
      !active ||
      !Number.isFinite(ms) ||
      ms < 3 ||
      ms > 90
    )
      return null;
    if (this.warmup-- > 0) return null;
    this.samples.push(ms);
    if (this.samples.length < 120) return null;
    const sorted = [...this.samples].sort((a, b) => a - b),
      median = sorted[60],
      slow = sorted[108];
    const quality =
      coarse || median > 24 || slow > 45
        ? 'low'
        : width >= 1000 && median < 12 && slow < 17
          ? 'high'
          : 'medium';
    this.preferences.set({ quality, qualityMode: 'auto', performanceCalibrated: true });
    return { quality, median };
  }
}
