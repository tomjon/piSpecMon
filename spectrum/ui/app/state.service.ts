import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { Config } from './config';
import { Data } from './data';
import { User } from './user';
import { Chart } from './chart';

@Injectable()
export class StateService {
  // the currently selected config, if any
  private config: Config;

  // registered charts FIXME this feels like a horrible mechanism :(
  private charts: Chart[] = [];

  // these will get set at app initialisation (nothing shows before these are set)
  public user: User;
  public values: any; // the current server settings (back to which we can reset, or replace on submit)

  constructor(private dataService: DataService) {}

  //FIXME could change this to 'config'
  public get currentConfig(): Config {
    return this.config;
  }

  public set currentConfig(config: Config) {
    this.config = config;
    if (config && config.data == undefined) {
      this.config.data = new Data(this, this.dataService, this.config);
    }
  }

  get ready(): boolean {
    return this.user != undefined && this.values != undefined;
  }

  public registerChart(chart: Chart) {
    this.charts.push(chart);
  }

  public resetCharts(): void {
    for (let chart of this.charts) {
      chart.reset();
    }
  }
}
