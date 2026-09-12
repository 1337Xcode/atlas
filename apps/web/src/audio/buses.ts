import * as Tone from 'tone';

export interface Buses { voice: Tone.Gain; archive: Tone.Gain; bed: Tone.Gain; foley: Tone.Gain; bedPlayer: Tone.Player; follower: Tone.Follower }

export function createBuses(bedUrl: string): Buses {
  const voice = new Tone.Gain(1).toDestination();
  const voiceComp = new Tone.Compressor(-18, 3).connect(voice);
  const archive = new Tone.Gain(Tone.dbToGain(-6)).toDestination();
  const archiveHp = new Tone.Filter(120, 'highpass').connect(archive);
  const bed = new Tone.Gain(Tone.dbToGain(-30)).toDestination();
  const bedLp = new Tone.Filter(1800, 'lowpass').connect(bed);
  const bedPlayer = new Tone.Player({ url: bedUrl, loop: true }).connect(bedLp);
  const foley = new Tone.Gain(Tone.dbToGain(-12)).toDestination();
  const follower = new Tone.Follower(0.05);
  voiceComp.connect(follower); archiveHp.connect(follower);
  (voiceComp as unknown as { busInput: Tone.ToneAudioNode }).busInput = voiceComp;
  return { voice: voiceComp as unknown as Tone.Gain, archive: archiveHp as unknown as Tone.Gain, bed, foley, bedPlayer, follower };
}

/** Reduces the bed by 6 dB while voice or archive carries signal. Call once per frame. */
export function duck(buses: Buses) {
  const level = buses.follower.getValue() as number;
  const target = Tone.dbToGain(level > 0.01 ? -36 : -30);
  buses.bed.gain.rampTo(target, 0.4);
}
