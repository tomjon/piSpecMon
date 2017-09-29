import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { DataService } from './data.service';
import { MessageService } from './message.service';
import { StatusService } from './status.service';
import { Config } from './config';
import { Data } from './data';
import { User } from './user';
import { Chart } from './chart';
import { WidgetComponent } from './widget.component';

let modelSort = function (a, b) {
  if (a.manufacturer == b.manufacturer) {
    return a.name < b.name ? -1 : 1;
  } else {
    return a.manufacturer < b.manufacturer ? -1 : 1;
  }
};

@Injectable()
export class StateService {
  public configs: Config[]; // all known Config

  // the currently selected config, if any
  private _currentConfig: Config;

  // the currently running config, if any
  private _runningConfig: Config;

  // and an observable for changes to current config
  public configChange: Subject<Config> = new Subject<Config>();

  public caps: {};
  public user: User;
  public values: any; // the current server settings (back to which we can reset, or replace on submit)
  public constants: any;
  public units: any[] = []; // derived from constants

  private widgets: WidgetComponent[] = [];

  constructor(private dataService: DataService, private messageService: MessageService, private statusService: StatusService) {
    statusService.subscribe(status => this.updateConfigs(status));
    dataService.getCurrentUser()
               .subscribe(user => {
                 this.user = user;
                 this.checkSuperior();
               });
    dataService.getSettings()
               .subscribe(values => this.values = values);
    dataService.getCaps()
               .subscribe(caps => {
                 if (caps.scan && caps.scan.models) {
                   caps.scan.models = caps.scan.models.sort(modelSort); //FIXME hmmm - do where it is needed, not here
                 }
                 this.caps = caps;
               });
    dataService.getConstants()
               .subscribe(constants => {
                 this.constants = constants;
                 for (let value in constants.hz_labels) {
                   this.units.push({ value: value, label: constants.hz_labels[value] });
                 }
                 statusService.run(constants.tick_interval);
               });
    dataService.getConfig()
               .subscribe(configs => this.configs = configs);
  }

  public getConfig(config_id: string): Config {
    return this.configs.find(config => config.id == config_id);
  }

  private updateConfigs(status: any): void {
    if (! status.config_id) return;

    this._runningConfig = this.configs.find(config => config.id == status.config_id);
    if (this._runningConfig == undefined) {
      // if we are seeing a new config, add it to the table
      this.dataService.getConfig(status.config_id)
                      .subscribe(configs => {
                        if (! this.configs.find(set => set.id == configs[0].id)) {
                          this.configs.push(configs[0]);
                        }
                      });
    } else {
      // otherwise, update the one we have
      let max_latest = 0;
      for (let key in status) {
        //FIXME there is probably a nicer way to do this max stuff
        if (status[key].sweep) {
          max_latest = Math.max(max_latest, status[key].sweep.timestamp);
        }
      }
      this._runningConfig.latest = max_latest; //FIXME do this in config object
      this._runningConfig.update_counts(status);
    }
  }

  private checkSuperior() {
    let s = this.user._superior;
    if (s != undefined) {
      this.messageService.show(`Downgraded to Data Viewer. ${s.real} is logged in as ${s._roleLabel} - contact them at ${s.email} or on ${s.tel}`);
    }
  }

  //FIXME A better method of finding all WidgetComponent instances might be something like this in AppComponent:
  //@ViewChildren('psm-widget', {descendants: true}) private widgets: QueryList<WidgetComponent>;
  // but descendants isn't allowed - will this ever exist?
  registerWidget(widget: WidgetComponent) {
    this.widgets.push(widget);
  }

  public get isPristine(): boolean {
    return ! this.widgets.some(w => ! w.isPristine);
  }

  public get currentConfig(): Config {
    return this._currentConfig;
  }

  public set currentConfig(config: Config) {
    this._currentConfig = config;
    if (config && config.data == undefined) {
      config.data = new Data(this, this.dataService, this.statusService, config); //FIXME is passing dataService fishy, here?
    }
    this.configChange.next(config);
  }

  public get runningConfig(): Config {
    return this._runningConfig;
  }

  get ready(): boolean {
    return this.user != undefined && this.configs != undefined && this.values != undefined && this.caps != undefined && this.constants != undefined;
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
