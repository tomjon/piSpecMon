import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { DataService } from './data.service';
import { Config } from './config';
import { Data } from './data';
import { User } from './user';
import { Chart } from './chart';
import { WidgetBase } from './widget.base';

@Injectable()
export class StateService {
  // the currently selected config, if any
  private config: Config;

  // and an observable for changes to current config
  public configChange: Subject<Config> = new Subject<Config>();

  // these will get set at app initialisation (nothing shows before these are set)
  public caps: {};
  public user: User;
  public values: any; // the current server settings (back to which we can reset, or replace on submit)
  public constants: any;

  //FIXME mechanism for AppComponent to get list of all widgets... hopefully something better in angular 4
  public widgets: WidgetBase[] = [];

  constructor(private dataService: DataService) {}

  registerWidget(widget: WidgetBase) {
    this.widgets.push(widget);
  }

  //FIXME could change this to 'config'
  public get currentConfig(): Config {
    return this.config;
  }

  public set currentConfig(config: Config) {
    this.config = config;
    if (config && config.data == undefined) {
      this.config.data = new Data(this, this.dataService, this.config);
    }
    this.configChange.next(config);
  }

  get ready(): boolean {
    return this.user != undefined && this.values != undefined && this.caps != undefined && this.constants != undefined;
  }

  // registered charts FIXME this feels like a horrible mechanism :( use a Subject instead?
  private charts: Chart[] = [];

  public registerChart(chart: Chart) {
    this.charts.push(chart);
  }

  public resetCharts(): void {
    for (let chart of this.charts) {
      chart.reset();
    }
  }

  public getWorkers(): any[] {
    let workers = [];
    for (let value in this.caps) {
      workers.push({value: value, label: this.workerLabel(value), enabled: true});
    }
    return workers;
  }

  public workerLabel(workerKey: string): string {
    return this.constants.worker_labels[workerKey] || '[unknown worker]';
  }
}
