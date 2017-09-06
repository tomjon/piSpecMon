import { Config } from './config';
import { MAX_N, CHART_HEIGHT } from './constants';

/**
 * Spectrum, audio and RDS data along with the associated frequencies.
 */
export class Data {
  config_id: string;
  freqs: any;
  count: number;
  spectrum: any;

  samples: any = {};
  audio: any = {length: 0};
  rdsNames: any = {};
  rdsText: any = {};
  temperature: any = [];
  timestamps: any = {};

  constructor(config: Config) {
    this.config_id = config.id;
    this.freqs = config.values.scan.freqs;
    this.count = 0;
    this.spectrum = {
      levels: [],
      agg: { latest: [], min: [], max: [], avg: [] }
    };
  }

  update(data: any): number {
    this.count += data.spectrum.length;
    this.mapSpectrum(data.spectrum);
    this.mapAudio(data.audio);
    this.mapRdsNames(data.rds_name);
    this.mapRdsText(data.rds_text);
    this.temperature = this.temperature.concat(data.temperature);

    for (let key of ['spectrum', 'audio', 'rds_name', 'rds_text', 'temperature']) {
      for (let t_data of data[key]) {
        this.timestamps[key] = Math.max(this.timestamps[key] || 0, t_data[0]);
      }
    }

    return +this.timestamps['spectrum'];
  }

  private fillArray(v?: any, size?: number) {
    if (size == null) size = MAX_N;
    let a = [];
    for (let n = 0; n < size; ++n) {
      a.push(v);
    }
    return a;
  }

  mapAudio(audio: any[]) {
    // want this.samples to be a lookup from freq_n to a list of { timestamp: .., path: .. }
    // want this.audio to be a lookup like this.audio[{sweep_n}_{freq_n}] = ..
    this.audio.length = audio.length;
    let sweep_n = -1;
    let sweep_t = null;
    if (! this.samples.length) this.samples.length = 0;
    for (let a of audio) {
      let audio_t = a[0];
      let freq_n = a[1];
      let path = `/audio/${this.config_id}/${freq_n}/${audio_t}`;
      if (! this.samples[freq_n]) {
        this.samples[freq_n] = [];
        ++this.samples.length;
      }
      this.samples[freq_n].push({ timestamp: audio_t, path: path });
      while (sweep_t == null || (sweep_t != 0 && audio_t > sweep_t)) {
        let sweep = this.spectrum.levels[++sweep_n];
        sweep_t = sweep ? sweep.timestamp : 0;
      }
      this.audio[`${sweep_n - 1}_${freq_n}`] = path;
    }
  }

  mapRdsNames(data: any[]) {
    for (let rds of data) {
      this.rdsNames[rds[1]] = rds[2]; //FIXME ignores timestamp, effectively takes last known RDS name per frequency
    }
  }

  mapRdsText(data: any[]) {
    for (let rds of data) {
      let freq_n = rds[1];
      if (this.rdsText[freq_n] == undefined) this.rdsText[freq_n] = [];
      this.rdsText[freq_n].push({ timestamp: +rds[0], text: rds[2] });
    }
  }

  mapSpectrum(data) {
    if (data.length == 0) return;

    // data[sweep_n] = [timestamp, [strength_0, strength_1, strength_2, .., strength_N]]
    for (let freq_idx in data[data.length - 1][1]) {
      // take into account failed readings (level -128)
      let strength = data[data.length - 1][1][freq_idx];
      this.spectrum.agg['latest'][freq_idx] = { idx: freq_idx, v: strength != -128 ? strength : null };
    }

    // set up avg initial totals (turn old avg values into old totals)
    for (let freq_idx in data[0][1]) {
      if (this.spectrum.agg['avg'][freq_idx] == null) {
        this.spectrum.agg['avg'][freq_idx] = { idx: freq_idx, v: 0 };
      } else {
        this.spectrum.agg['avg'][freq_idx].v *= this.spectrum.levels.length;
      }
    }

    for (let sweep_idx in data) {
      let levels = {
        level: this.fillArray(0, length),
        timestamp: data[sweep_idx][0],
        sweep_n: this.spectrum.levels.length
      };
      this.spectrum.levels.push(levels);

      for (let freq_idx in data[sweep_idx][1]) {
        let strength = data[sweep_idx][1][freq_idx];
        if (strength == -128) {
          // failed reading, remove from data
          data[sweep_idx][1][freq_idx] = null;
          continue;
        }
        if (this.spectrum.agg['min'][freq_idx] == null || strength < this.spectrum.agg['min'][freq_idx].v) {
          this.spectrum.agg['min'][freq_idx] = { idx: freq_idx, v: strength };
        }
        if (this.spectrum.agg['max'][freq_idx] == null || strength > this.spectrum.agg['max'][freq_idx].v) {
          this.spectrum.agg['max'][freq_idx] = { idx: freq_idx, v: strength };
        }
        this.spectrum.agg['avg'][freq_idx].v += strength;
        levels.level[freq_idx] = strength;
      }
    }

    // resolve totals back into averages
    for (let freq_idx in this.spectrum.agg['avg']) {
      let freq = this.spectrum.agg['avg'][freq_idx];
      freq.v = Math.round(freq.v / this.spectrum.levels.length);
    }

    /* find top N by avg, min and max */
    this.spectrum.freq_idxs = {'min': this.fillArray(), 'max': this.fillArray(), 'avg': this.fillArray()};

    for (let x in this.spectrum.freq_idxs) {
      // see if it beats any, if so swap and keep looking down the list... drop off end and gets kicked out
      for (let _idx in this.spectrum.agg[x]) {
        let idx = +_idx;
        let v = this.spectrum.agg[x][idx].v;

        // peak detection - only do this when scanning a range
        if (this.freqs.range && idx > 0 && idx + 1 < this.spectrum.agg[x].length) {
          if (this.spectrum.agg[x][idx - 1].v >= v || v < this.spectrum.agg[x][idx + 1].v) {
            continue;
          }
        }

        // try slotting in our value
        for (let n: number = 0; n < MAX_N; ++n) {
          let slot_idx = this.spectrum.freq_idxs[x][n];
          // if we find an empty slot, just use it and quit
          if (slot_idx == null) {
            this.spectrum.freq_idxs[x][n] = idx;
            break;
          }
          let slot_v = this.spectrum.agg[x][slot_idx].v;
          // otherwise, compare with each slot, swapping if we beat it
          if ((x == 'min' && v < slot_v) || (x != 'min' && v > slot_v)) {
            let tmp = idx;
            idx = slot_idx;
            this.spectrum.freq_idxs[x][n] = tmp;
            v = slot_v;
          }
        }
      }
    }
  }

  // reduce existing data down to a fixed number (count) of sweeps (for waterfall display)
  reduceSpectrum(sweeps: number): any[] {
    let interval = this.spectrum.levels.length / sweeps;
    let levels: any[] = [];

    let level_idx = 0, count = null;

    for (let sweep_idx in this.spectrum.levels) {
      if (! levels[level_idx]) {
        let length = this.spectrum.levels[sweep_idx].level.length;
        levels[level_idx] = {
          level: this.fillArray(0, length),
          timestamp: this.spectrum.levels[sweep_idx].timestamp,
          sweep_n: +sweep_idx
        };
        count = this.fillArray(0, length);
      }

      let level = this.spectrum.levels[sweep_idx].level;
      for (let freq_idx in level) {
        if (level[freq_idx] == undefined) {
          continue;
        }
        levels[level_idx].level[freq_idx] += level[freq_idx];
        ++count[freq_idx];
      }

      if (+sweep_idx >= (level_idx + 1) * interval - 1 || +sweep_idx == length - 1) {
        let level = levels[level_idx].level;
        for (let freq_idx in level) {
          if (count[freq_idx] > 0) {
            level[freq_idx] = Math.round(level[freq_idx] / count[freq_idx]);
          } else {
            level[freq_idx] = -128; // no reading
          }
        }

        ++level_idx;
        count = null;
      }
    }

    return levels;
  }
}
