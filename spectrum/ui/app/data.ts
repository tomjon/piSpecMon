import { Config } from './config';
import { DataService } from './data.service';
import { StateService } from './state.service';
import { WorkerData } from './worker-data';

/**
 * Spectrum, audio and RDS data along with the associated frequencies.
 */
export class Data {
  config: Config;

  //freqs: any; USE config.values.[worker].freqs or whatever

  loading: number;

  workers: { [key: string]: WorkerData; }; // per worker data

  constructor(private stateService: StateService, private dataService: DataService, config: Config) {
    this.config = config;
    this.workers = {};
    for (let worker of config.values.workers) {
      this.workers[worker] = new WorkerData();
    }
    this.loadData();
  }

  get config_id(): string {
    return this.config.id;
  }

  private loadData(starts=undefined) {
    console.log("Loading data for " + this.config.id, starts);
    if (starts == undefined) {
      this.loading = 0;
      starts = {};
    } else if (this.loading >= 10) {
      this.loading = undefined;
      return;
    }
    let block = (this.config.latest - this.config.first) / 10;
    let end = Math.round(this.config.first + (this.loading + 1) * block);

    let skip = true;
    for (let worker of this.config.values.workers) {
      if (this.config.counts[worker] > 100) {
        // just grab everything if there are 100 or fewer sweeps
        skip = false;
      }
    }
    if (skip || this.loading >= 9) { //FIXME surely... don't set this.loading to 10, but undefined?
      end = undefined;
      this.loading = 10;
    }

    this.dataService.getData(this.config_id, starts, end)
                    .subscribe(data => {
                      this.update(data);
                      ++this.loading;
                      this.loadData(this.timestamps);
                      this.stateService.resetCharts();
                    });
  }

  //FIXME this should be private, see app.component.ts
  public get timestamps(): { [key: string]: number; } {
    let t: { [key: string]: number; } = {};
    for (let key in this.workers) {
      t[key] = this.workers[key].timestamp;
    }
    return t; //FIXME might be able to do this with a one-liner, like this.workers.map(..) but does that work on objects?
  }

  private update(data: any) {
    for (let worker in data) {
      let max_n = this.stateService.constants.max_n;
      let detectPeaks = this.config.values[worker].freqs[0].enabled;
      this.workers[worker].update(data[worker], this.config.id, max_n, detectPeaks);
    }
  }

  public update_status(status: any) {
    if (status.sweep && this.loading == undefined) {
      this.dataService.getData(this.config.id, this.timestamps)
                      .subscribe(data => {
                        this.update(data);
                        this.stateService.resetCharts();
                      });
    }
  }
}
