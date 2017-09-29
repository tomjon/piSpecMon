import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { DataService } from './data.service';
import { Config } from './config';
import { Data } from './data';
import { User } from './user';
import { Chart } from './chart';
import { WidgetComponent } from './widget.component';

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

  private widgets: WidgetComponent[] = [];

  constructor(private dataService: DataService) {}

  //FIXME A better method of finding all WidgetComponent instances might be something like this in AppComponent:
  //@ViewChildren('psm-widget', {descendants: true}) private widgets: QueryList<WidgetComponent>;
  // but descendants isn't allowed - will this ever exist?
  registerWidget(widget: WidgetComponent) {
    this.widgets.push(widget);
  }

  public get isPristine(): boolean {
    return ! this.widgets.some(w => ! w.isPristine);
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

  public workerEnabled(key: string): boolean {
    return this.caps[key] === undefined || this.caps[key] != null;
  }

  public getWorkers(): any[] {
    let workers = [];
    for (let value in this.caps) {
      if (! this.workerEnabled(value)) continue;
      workers.push({value: value, label: this.workerLabel(value), enabled: true});
    }
    return workers;
  }

  public workerLabel(workerKey: string): string {
    return this.constants.worker_labels[workerKey] || '[unknown worker]';
  }
}
