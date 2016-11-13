import { Config } from './config';
import { MAX_N, CHART_HEIGHT } from './constants';

/**
 * Spectrum, audio and RDS data along with the associated frequencies.
 */
export class Data {

  freqs: any;
  count: number;
  spectrum: any;
  audio: any;
  rdsNames: any;
  rdsText: any;

  constructor(config: Config, data: any) {
    this.freqs = config.values.freqs;
    this.count = data.spectrum.length;
    this.mapSpectrum(data.spectrum);
    this.mapAudio(data.audio, config.id);
    this.mapRdsNames(data.rds.name);
    this.mapRdsText(data.rds.text);
  }

  private fillArray(v?: any, size?: number) {
    if (size == null) size = MAX_N;
    let a = [];
    for (let n = 0; n < size; ++n) {
      a.push(v);
    }
    return a;
  }

  mapAudio(audio: any[], config_id: string) {
    // want this.audio to be a lookup like this.audio[{sweep_n}_{freq_n}] = ..
    this.audio = { length: audio.length };
    let sweep_n = -1;
    let sweep_t = null;
    for (let a of audio) {
      let audio_t = a[0];
      let freq_n = a[1];
      while (sweep_t == null || (sweep_t != 0 && audio_t > sweep_t)) {
        let sweep = this.spectrum.levels[++sweep_n];
        sweep_t = sweep ? sweep.fields.timestamp : 0;
      }
      this.audio[`${sweep_n - 1}_${freq_n}`] = `/audio/${config_id}/${freq_n}/${audio_t}`;
    }
  }

  mapRdsNames(data: any[]) {
    this.rdsNames = { };
    for (let rds of data) {
      this.rdsNames[rds[1]] = rds[2]; //FIXME ignores timestamp, effectively takes last known RDS name per frequency
    }
  }

  mapRdsText(data: any[]) {
    this.rdsText = { };
    for (let rds of data) {
      let freq_n = rds[1];
      if (this.rdsText[freq_n] == undefined) this.rdsText[freq_n] = [];
      this.rdsText[freq_n].push({ timestamp: +rds[0], text: rds[2] });
    }
  }

  mapSpectrum(data) {
    var interval = data.length / CHART_HEIGHT;

    this.spectrum = {
      levels: [],
      agg: { latest: [], min: [], max: [], avg: [] },
      freq_idxs: { 'min': this.fillArray(), 'max': this.fillArray(), 'avg': this.fillArray() }
    };

    if (data.length > 0) {
      // data[sweep_n] = [timestamp, [strength_0, strength_1, strength_2, .., strength_N]]
      for (let freq_idx in data[data.length - 1][1]) {
        // take into account failed readings (level -128)
        let strength = data[data.length - 1][1][freq_idx];
        this.spectrum.agg['latest'][freq_idx] = { idx: freq_idx, v: strength != -128 ? strength : null };
      }
      let level_idx = 0, count = null;//FIXME I think level_idx is/should be freq_n?? or is it sweep_n??

      for (let sweep_idx in data) {
        let length = data[sweep_idx][1].length;

        if (! this.spectrum.levels[level_idx]) {
          this.spectrum.levels[level_idx] = {
            fields: {
              level: this.fillArray(0, length),
              timestamp: data[sweep_idx][0],
              sweep_n: +sweep_idx
            }
          };
          count = this.fillArray(0, data[sweep_idx][1].length);
        }

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
          if (this.spectrum.agg['avg'][freq_idx] == null) {
            this.spectrum.agg['avg'][freq_idx] = { idx: freq_idx, v: 0 };
          }
          this.spectrum.agg['avg'][freq_idx].v += strength / data.length;

          this.spectrum.levels[level_idx].fields.level[freq_idx] += strength;
          ++count[freq_idx];
        }

        if (+sweep_idx >= (level_idx + 1) * interval - 1 || +sweep_idx == length - 1) {
          for (let freq_idx in data[sweep_idx][1]) {
            let level = this.spectrum.levels[level_idx].fields.level;
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

      for (let freq_idx in this.spectrum.agg['avg']) {
        let freq = this.spectrum.agg['avg'][freq_idx];
        freq.v = Math.round(freq.v);
      }

      /* find top N by avg, min and max */
      for (let x in this.spectrum.freq_idxs) {
        // see if it beats any, if so swap and keep looking down the list... drop off end and gets kicked out
        for (let _idx in this.spectrum.agg[x]) {
          let idx = +_idx;

          let v = this.spectrum.agg[x][idx].v;

          if (idx > 0 && idx + 1 < this.spectrum.agg[x].length) {
            if (this.spectrum.agg[x][idx - 1].v >= v || v < this.spectrum.agg[x][idx + 1].v) {
              continue;
            }
          }

          let i: number = idx; //FIXME needed??
          // try slotting in our value
          for (let n: number = 0; n < MAX_N; ++n) {
            let slot_idx = this.spectrum.freq_idxs[x][n];
            // if we find an empty slot, just use it and quit
            if (slot_idx == null) {
              this.spectrum.freq_idxs[x][n] = i;
              break;
            }
            let slot_v = this.spectrum.agg[x][slot_idx].v;
            // otherwise, compare with each slot, swapping if we beat it
            if ((x == 'min' && v < slot_v) || (x != 'min' && v > slot_v)) {
              let tmp = i;
              i = slot_idx;
              this.spectrum.freq_idxs[x][n] = tmp;
              v = slot_v;
            }
          }
        }
      }
    }
  }

}
