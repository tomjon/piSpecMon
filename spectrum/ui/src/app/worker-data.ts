export class WorkerData {
  errors: string[] = [];
  spectrum: any = {
    levels: [],
    agg: { latest: [], min: [], max: [], avg: [] }
  };
  samples: any = [];
  audio: any = [];
  rdsNames: any = {};
  rdsText: any = {};
  temperature: any = [];
  timestamp: number;

  constructor(private key: string) {}

  update(data: any, config_id: string, max_n: number, detectPeaks: boolean): void {
    this.errors = data.errors;
    this.mapSpectrum(data.spectrum, max_n, detectPeaks);
    this.mapAudio(data.audio, config_id);
    this.mapRdsNames(data.rds_name);
    this.mapRdsText(data.rds_text);
    this.mapTemperature(data.temperature);
  }

  private updateTimestamp(t: number) {
    this.timestamp = Math.max(this.timestamp || t, t);
  }

  // update from [[time0, temp0], [time1, temp1], [time2, temp2], ...]
  private mapTemperature(temperature: any[]) {
    if (temperature.length == 0) return;
    this.temperature = this.temperature.concat(temperature);
    this.updateTimestamp(this.temperature[this.temperature.length - 1][0]);
  }

  private mapAudio(audio: any[], config_id: string) {
    // want this.samples to be a lookup from freq_n to a list of {timestamp: .., path: .., filetype: .., filesize: ..}
    // want this.audio to be a lookup like this.audio[{sweep_n}_{freq_n}] = ..
    let sweep_n = -1;
    let sweep_t = null;
    for (let a of audio) {
      if (a.filesize) {
        this.updateTimestamp(a.timestamp);
      }
      a.path = `/audio/${config_id}/${this.key}/${a.freq_n}/${a.timestamp}`;
      while (sweep_t == null || (sweep_t != 0 && a.timestamp > sweep_t)) {
        let sweep = this.spectrum.levels[++sweep_n];
        sweep_t = sweep ? sweep.timestamp : 0;
      }
      if (! this.samples[a.freq_n]) {
        this.samples[a.freq_n] = [];
      }
      this.samples[a.freq_n][sweep_n - 1] = a;
      if (a.filesize) {
        this.audio[`${sweep_n - 1}_${a.freq_n}`] = a.path;
      }
    }
  }

  private mapRdsNames(data: any[]) {
    for (let rds of data) {
      this.rdsNames[rds[1]] = rds[2]; // ignores timestamp, effectively takes last known RDS name per frequency
      this.updateTimestamp(rds[0]);
    }
  }

  private mapRdsText(data: any[]) {
    for (let rds of data) {
      let freq_n = rds[1];
      if (this.rdsText[freq_n] == undefined) this.rdsText[freq_n] = [];
      this.rdsText[freq_n].push({ timestamp: +rds[0], text: rds[2] });
      this.updateTimestamp(rds[0]);
    }
  }

  private fillArray(v: any, size: number) {
    let a = [];
    for (let n = 0; n < size; ++n) {
      a.push(v);
    }
    return a;
  }

  private mapSpectrum(data: any[], max_n: number, detectPeaks: boolean) {
    if (data.length == 0) return;

    // just take the last spectrum to get latest timestamp
    this.updateTimestamp(data[data.length - 1][0]);

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
    this.spectrum.freq_idxs = {'min': this.fillArray(null, max_n),
                               'max': this.fillArray(null, max_n),
                               'avg': this.fillArray(null, max_n)};

    for (let x in this.spectrum.freq_idxs) {
      // see if it beats any, if so swap and keep looking down the list... drop off end and gets kicked out
      for (let _idx in this.spectrum.agg[x]) {
        let idx = +_idx;
        let v = this.spectrum.agg[x][idx].v;

        // peak detection
        if (detectPeaks && idx > 0 && idx + 1 < this.spectrum.agg[x].length) {
          if (this.spectrum.agg[x][idx - 1].v >= v || v < this.spectrum.agg[x][idx + 1].v) {
            continue;
          }
        }

        // try slotting in our value
        for (let n: number = 0; n < this.spectrum.freq_idxs[x].length; ++n) {
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
  public reduceSpectrum(sweeps: number): any[] {
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
