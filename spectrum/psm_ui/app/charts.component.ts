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
  loading: boolean = false;

  @Input() set status(status: any) {
    if (status && this.config && status.config_id == this.config.id && status.sweep && this.config.data && status.sweep.sweep_n > this.config.data.count) {
      this.dataService.getData(this.config.id, this.config.data.timestamps)
                      .subscribe(data => this.timestamp = this.config.data.update(data));
    }
  }

  @Input('config') set _config(config: Config) {
    this.config = config;
    if (config.data == undefined) this.getData();
  }

  constructor(private dataService: DataService) { }

  private getData() {
    this.loading = true;
    this.dataService.getData(this.config.id, {})
                    .subscribe(data => {
                      this.config.data = new Data(this.config);
                      this.timestamp = this.config.data.update(data);
                      this.loading = false;
                    });
  }
}
