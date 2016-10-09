import { Component, Input, ViewChild } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { FrequencyComponent } from './frequency.component';
import { LevelComponent } from './level.component';
import { WaterfallComponent } from './waterfall.component';
import { RdsTableComponent } from './rds-table.component';
import { DataService } from './data.service';
import { Config } from './config';
import { Data } from './data';

@Component({
  selector: 'psm-charts',
  templateUrl: 'templates/charts.html',
  directives: [ FrequencyComponent, LevelComponent, WaterfallComponent, RdsTableComponent ]
})
export class ChartsComponent {
  config: Config;
  data: Data;

  @Input() set status(status: any) {
    if (status && this.config && status.config_id == this.config.id && status.sweep && this.data && status.sweep.sweep_n > this.data.count) {
      this.getData();
    }
  }

  @Input('config') set _config(config: Config) {
    this.config = config;
    if (config) {
      this.getData();
    } else {
      this.data = undefined;
    }
  }

  constructor(private dataService: DataService) { }

  private getData() {
    delete this.data;
    this.dataService.getData(this.config.id)
                    .subscribe(data => this.data = new Data(this.config, data));
  }
}
