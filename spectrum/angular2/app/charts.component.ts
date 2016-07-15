import { Component, Input, ViewChild } from '@angular/core';
import { SweepComponent } from './sweep.component';
import { RangeComponent } from './range.component';
import { FrequencyComponent } from './frequency.component';
import { LevelComponent } from './level.component';
import { WaterfallComponent } from './waterfall.component';
import { DataService } from './data.service';
import { ErrorService } from './error.service';

//FIXME constants
var chartHeight = 400;
var maxN = 10; //FIXME is this the maximum number of 'top N'? YES I think so. Repeats in level.component.ts

@Component({
  selector: 'psm-charts',
  templateUrl: 'templates/charts.html',
  directives: [ RangeComponent, FrequencyComponent, LevelComponent, WaterfallComponent ]
})
export class ChartsComponent {
  data: any = { }; //FIXME replace with a SpectrumData object? (new class)
  avg_time: number;

  @Input() config: any;
  @Input('config_id') config_id: string;
  @Input('sweep') sweepComponent: SweepComponent; //FIXME just to pass access to getTimestamp through to RangeComponent - well, if you passed around a Config class instead of just config_id.....

  @ViewChild('range') rangeComponent; //FIXME unused!

  constructor(private dataService: DataService, private errorService: ErrorService) { }

  ngOnChanges() {
    this.data = { };
  }

  show(range: number[]) {
    this.dataService.getData(this.config_id, range)
                    .subscribe(
                      data => this.update(data),
                      error => this.errorService.logError(this, error)
                    );
  }

  private fillArray(v?: any, size?: number) {
    if (size == null) size = maxN;
    let a = [];
    for (let n = 0; n < size; ++n) {
      a.push(v);
    }
    return a;
  }

  update(data) {
    var interval = data.length / chartHeight;

    this.data = {
                  levels: [],
                  agg: { latest: [], min: [], max: [], avg: [] },
                  freq_idxs: { 'min': this.fillArray(), 'max': this.fillArray(), 'avg': this.fillArray() }
                };
    delete this.avg_time;

    /* also compute sweep time */
    let total_time = 0.0; //FIXME can this move inside the next scope?

    if (data.length > 0) {
      for (let freq_idx in data[data.length - 1].fields.level) {
        // take into account failed readings (level -128)
        let level = data[data.length - 1].fields.level[freq_idx];
        this.data.agg['latest'][freq_idx] = { idx: freq_idx, v: level != -128 ? level : null };
      }
      let level_idx = 0, count = null;
      for (let sweep_idx in data) {
        var length = data[sweep_idx].fields.level.length;
        total_time += data[sweep_idx].fields.totaltime[0];

        if (! this.data.levels[level_idx]) {
          this.data.levels[level_idx] = { fields: { } };
          this.data.levels[level_idx].fields.level = this.fillArray(0, length);
          this.data.levels[level_idx].fields.timestamp = data[sweep_idx].fields.timestamp;
          count = this.fillArray(0, data[sweep_idx].fields.level.length);
        }

        for (let freq_idx in data[sweep_idx].fields.level) {
          let level = data[sweep_idx].fields.level[freq_idx];
          if (level == -128) {
            // failed reading, remove from data
            data[sweep_idx].fields.level[freq_idx] = null;
            continue;
          }
          if (this.data.agg['min'][freq_idx] == null || level < this.data.agg['min'][freq_idx].v) {
            this.data.agg['min'][freq_idx] = { idx: freq_idx, v: level };
          }
          if (this.data.agg['max'][freq_idx] == null || level > this.data.agg['max'][freq_idx].v) {
            this.data.agg['max'][freq_idx] = { idx: freq_idx, v: level };
          }
          if (this.data.agg['avg'][freq_idx] == null) {
            this.data.agg['avg'][freq_idx] = { idx: freq_idx, v: 0 };
          }
          this.data.agg['avg'][freq_idx].v += level / data.length;

          this.data.levels[level_idx].fields.level[freq_idx] += level;
          ++count[freq_idx];
        }

        if (+sweep_idx >= (level_idx + 1) * interval - 1 || +sweep_idx == length - 1) {
          for (let freq_idx in data[sweep_idx].fields.level) {
            if (count[freq_idx] > 0) {
              this.data.levels[level_idx].fields.level[freq_idx] /= count[freq_idx];
            } else {
              this.data.levels[level_idx].fields.level[freq_idx] = -128; // no reading
            }
          }

          ++level_idx;
          count = null;
        }
      }

      this.avg_time = total_time / (1000 * data.length);

      /* find top N by avg, min and max */
      for (let x in this.data.freq_idxs) {
        // see if it beats any, if so swap and keep looking down the list... drop off end and gets kicked out
        for (let idx in this.data.agg[x]) {
          let v = this.data.agg[x][idx].v;

          if (+idx > 0 && idx + 1 < this.data.agg[x].length) {
            if (this.data.agg[x][+idx - 1].v >= v || v < this.data.agg[x][idx + 1].v) {
              continue;
            }
          }

          let i = idx; //FIXME needed??
          // try slotting in our value
          for (let n = 0; n < maxN; ++n) {
            let slot_idx = this.data.freq_idxs[x][n];
            // if we find an empty slot, just use it and quit
            if (slot_idx == null) {
              this.data.freq_idxs[x][n] = i;
              break;
            }
            let slot_v = this.data.agg[x][slot_idx].v;
            // otherwise, compare with each slot, swapping if we beat it
            if ((x == 'min' && v < slot_v) || (x != 'min' && v > slot_v)) {
              let tmp = i;
              i = slot_idx;
              this.data.freq_idxs[x][n] = tmp;
              v = slot_v;
            }
          }
        }
      }
    }
  }
}
