import type { Profile } from './profile.ts';

type Settings = Profile['settings'];
export class RoadAudio {
  private context?: AudioContext;
  private output?: GainNode;
  private noise?: AudioBuffer;
  private ambience?: { source: AudioBufferSourceNode; filter: BiquadFilterNode; level: GainNode };
  private bed?: { tone: OscillatorNode; level: GainNode };
  private enabled = false;

  configure(settings: Settings, region: number, camp: boolean, gesture = false) {
    this.enabled = settings.sound;
    if (!this.context && (!settings.sound || !gesture || !window.AudioContext)) return;
    try {
      const context = (this.context ??= new AudioContext());
      if (!this.output) {
        this.output = context.createGain();
        this.output.gain.value = 0;
        this.output.connect(context.destination);
      }
      if (settings.sound && gesture && context.state === 'suspended')
        void context.resume().catch(() => {});
      this.output.gain.setTargetAtTime(
        settings.sound ? settings.volume / 100 : 0,
        context.currentTime,
        0.12,
      );
      if (!settings.sound) return;
      if (!this.ambience) this.startAmbience(context, this.output);
      const pitch = camp ? 180 : [110, 147, 123][region];
      this.bed!.tone.frequency.setTargetAtTime(pitch / 2, context.currentTime, 0.8);
      this.bed!.level.gain.setTargetAtTime(camp ? 0.024 : 0.014, context.currentTime, 0.8);
      this.ambience!.filter.frequency.setTargetAtTime(
        camp ? 1150 : [360, 610, 430][region],
        context.currentTime,
        0.7,
      );
      this.ambience!.level.gain.setTargetAtTime(camp ? 0.073 : 0.055, context.currentTime, 0.7);
    } catch {
      // Audio availability is independent of the game simulation.
    }
  }
  private startAmbience(context: AudioContext, destination: GainNode) {
    const source = context.createBufferSource();
    this.noise = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const data = this.noise.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < data.length; i++) {
      previous = 0.78 * previous + 0.22 * (Math.random() * 2 - 1);
      const envelope = Math.min(i / 200, (data.length - 1 - i) / 200, 1);
      data[i] = envelope * (previous + (Math.random() > 0.99965 ? Math.random() * 0.9 : 0));
    }
    source.buffer = this.noise;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    const level = context.createGain();
    level.gain.value = 0.04;
    source.connect(filter).connect(level).connect(destination);
    source.start();
    this.ambience = { source, filter, level };
    const tone = context.createOscillator();
    const bedLevel = context.createGain();
    bedLevel.gain.value = 0;
    tone.type = 'sine';
    tone.connect(bedLevel).connect(destination);
    tone.start();
    this.bed = { tone, level: bedLevel };
  }
  cue(kind: 'travel' | 'resolve' | 'camp' | 'win' | 'loss') {
    const context = this.context,
      output = this.output;
    if (!this.enabled || !context || !output || context.state !== 'running') return;
    const notes = {
      travel: [105, 132],
      resolve: [196, 247],
      camp: [147, 175],
      win: [196, 247, 294, 392],
      loss: [165, 131, 98],
    }[kind];
    notes.forEach((frequency, index) => {
      const tone = context.createOscillator(),
        level = context.createGain();
      const when = context.currentTime + index * 0.11;
      tone.type = 'triangle';
      tone.frequency.value = frequency;
      level.gain.setValueAtTime(0.001, when);
      level.gain.exponentialRampToValueAtTime(0.16, when + 0.04);
      level.gain.exponentialRampToValueAtTime(0.001, when + 0.31);
      tone.connect(level).connect(output);
      tone.start(when);
      tone.stop(when + 0.34);
      tone.onended = () => {
        tone.disconnect();
        level.disconnect();
      };
    });
  }
}
