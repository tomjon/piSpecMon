import { Component, Input, ViewChild } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { FrequencyComponent } from './frequency.component';
import { LevelComponent } from './level.component';
import { WaterfallComponent } from './waterfall.component';
import { SampleTableComponent } from './sample-table.component';
import { RdsTableComponent } from './rds-table.component';
import { TemperatureComponent } from './temperature.component';
import { DataService } from './data.service';
import { Config } from './config';
import { Data } from './data';

@Component({
  selector: 'psm-charts',
  templateUrl: 'templates/charts.html',
  directives: [ FrequencyComponent, LevelComponent, WaterfallComponent, SampleTableComponent, RdsTableComponent, TemperatureComponent ]
})
export class ChartsComponent {
  config: Config;
  timestamp: number;
  loading: number = 0;

  @Input() set status(status: any) {
    if (status && this.config && status.config_id == this.config.id && status.sweep && this.config.data && status.sweep.sweep_n > this.config.data.count) {
      this.dataService.getData(this.config.id, this.config.data.timestamps)
                      .subscribe(data => this.timestamp = this.config.data.update(data));
    }
  }

  @Input('config') set _config(config: Config) {
    this.config = config;
    if (config.data == undefined) {
      this.config.data = new Data(this.config);
      this.getData();
    }
  }

  constructor(private dataService: DataService) { }

  private getData(starts=undefined) {
    if (starts == undefined) {
      this.loading = 0;
      starts = {};
    } else if (this.loading == 10) {
      return;
    }
    let block = (this.config.latest - this.config.first) / 10;
    let end = Math.round(this.config.first + (this.loading + 1) * block);
    if (this.config.count < 100) {
      // just grab everything if there are fewer than 100 sweeps
      this.loading = 9;
      end = undefined;
    }
    this.dataService.getData(this.config.id, starts, end)
                    .subscribe(data => {
                      this.timestamp = this.config.data.update(data);
                      ++this.loading;
                      this.getData(this.config.data.timestamps);
                    });
  }
}
