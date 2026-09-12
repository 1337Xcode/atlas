import * as Tone from 'tone';

export interface Buses { voice: Tone.Gain; archive: Tone.Gain; bed: Tone.Gain; foley: Tone.Gain; bedPlayer: Tone.Player; level: Tone.Meter }

export function createBuses(bedUrl: string): Buses {
  const voice = new Tone.Gain(1).toDestination();
  const voiceComp = new Tone.Compressor(-18, 3).connect(voice);
  const archive = new Tone.Gain(Tone.dbToGain(-6)).toDestination();
  const archiveHp = new Tone.Filter(120, 'highpass').connect(archive);
  const bed = new Tone.Gain(Tone.dbToGain(-30)).toDestination();
  const bedLp = new Tone.Filter(1800, 'lowpass').connect(bed);
  const bedPlayer = new Tone.Player({ url: bedUrl, loop: true }).connect(bedLp);
  const foley = new Tone.Gain(Tone.dbToGain(-12)).toDestination();
  // note: a meter reports the current level, which is what the ducking decision needs
  const level = new Tone.Meter({ normalRange: true, smoothing: 0.9 });
  voiceComp.connect(level); archiveHp.connect(level);
  (voiceComp as unknown as { busInput: Tone.ToneAudioNode }).busInput = voiceComp;
  return { voice: voiceComp as unknown as Tone.Gain, archive: archiveHp as unknown as Tone.Gain, bed, foley, bedPlayer, level };
}

/** Reduces the bed by 6 dB while voice or archive carries signal. Call once per frame. */
export function duck(buses: Buses) {
  // note: a single channel meter reports one number, not an array
  const reading = buses.level.getValue() as number;
  const target = Tone.dbToGain(reading > 0.01 ? -36 : -30);
  buses.bed.gain.rampTo(target, 0.4);
}
