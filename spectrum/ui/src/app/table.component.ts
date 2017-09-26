import { Component, Input, Output, ViewChild, EventEmitter } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { MessageService } from './message.service';
import { DataService } from './data.service';
import { StateService } from './state.service';
import { User } from './user';
import { Config } from './config';
import { DatePipe } from './date.pipe';
import { UnitsPipe } from './units.pipe';

@Component({
  selector: 'psm-table',
  template: `<psm-widget>
              <table class="table table-condensed">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>First timestamp</th>
                    <th>Last timestamp</th>
                    <th *ngFor="let worker of workers" class="feature">{{worker.label}}</th>
                    <th class="indicator">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let config of configs" (click)="onSelect(config.id, $event)" [ngClass]="{ 'row-selected': selected == config.id }" [title]="config.values.description || '[no description]'">
                    <td>{{config.values.user}}</td>
                    <td>{{config.timestamp | date}}</td>
                    <td>{{config.latest | date}}</td>
                    <td *ngFor="let worker of workers" class="feature">
                      <span *ngIf="audioEnabled(config, worker)" class="glyphicon glyphicon-volume-up"></span>
                      {{configSummary(config, worker)}} <span *ngIf="config.counts[worker.value] > 0" class="count">[{{config.counts[worker.value]}}]</span>
                    </td>
                    <td class="indicator">
                      <div *ngIf="user.roleIn(['admin']) || running(config)">
                        <input *ngIf="! running(config)" type="checkbox" [disabled]="standby" [(ngModel)]="checked[config.id]">
                        <span *ngIf="running(config)" class="running">&#x25FC;</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div *ngIf="user.roleIn(['admin'])" class="btn-right">
                <button type="button" (click)="onCheckAll()" class="btn btn-default" [disabled]="loading || standby || checkedIds().length == maxChecked">All</button>
                <button type="button" (click)="onCheckNone()" class="btn btn-default" [disabled]="loading || standby || checkedIds().length == 0">None</button>
                <button type="button" (click)="onDelete()" class="btn btn-default" [disabled]="loading || standby || checkedIds().length == 0"><input type="checkbox" onclick="return false" checked>&nbsp;Delete</button>
              </div>
            </psm-widget>`
})
export class TableComponent {
  @Input() user: User;
  @Output('select') select = new EventEmitter<Config>();

  configs: Config[] = [ ];
  checked: any = { };
  selected: string;

  // descriptor for each available worker
  workers: any[] = [];

  // true when waiting for (real) status after startup
  standby: boolean = true;

  // id of the running config set, if any
  config_id: string;

  // rds checkbox for export/download
  rds: boolean = false;

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(private dataService: DataService, private stateService: StateService, private messageService: MessageService) { }

  @Input('status') set _status(status) {
    if (status == undefined) return;
    this.standby = false;
    this.config_id = undefined;
    for (let key in status) { //FIXME there's a fixme for this in app.component as well :(
      if (status[key].config_id) this.config_id = status[key].config_id;
    }
    if (! this.config_id) return;

    let config: Config = this.configs.find(set => set.id == this.config_id);
    if (! config) {
      // if we are seeing a new config, add it to the table
      this.widgetComponent.busy(this.dataService.getConfig(this.config_id))
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
      config.latest = max_latest; //FIXME do this in config object

      config.update_counts(status);
    }
  }

  ngOnInit() {
    this.widgetComponent.busy(this.dataService.getConfig())
                        .subscribe(configs => this.configs = configs);
    this.workers = this.stateService.getWorkers();
  }

  onSelect(config_id, e) {
    if (e.target.tagName != 'INPUT') {
      this.selected = this.selected == config_id ? undefined : config_id;
      let config = this.getConfig(this.selected);
      this.select.emit(config); //FIXME this can go?
      this.stateService.currentConfig = config;
    }
  }

  getConfig(config_id: string): Config {
    if (config_id == undefined) {
      return undefined;
    }
    for (let config of this.configs) {
      if (config.id == config_id) {
        return config;
      }
    }
    return undefined;
  }

  checkedIds(): string[] {
    let ids = [ ];
    for (let id in this.checked) {
      if (this.checked[id]) ids.push(id);
    }
    return ids;
  }

  onCheckAll() {
    for (let config of this.configs) {
      if (config.id != this.config_id) this.checked[config.id] = true;
    }
  }

  onCheckNone() {
    this.checked = { };
  }

  get maxChecked(): number {
    return this.configs.length - (this.config_id ? 1 : 0);
  }

  onDelete() {
    let ids = this.checkedIds();
    this.widgetComponent.busy(this.dataService.deleteConfig(ids))
                        .subscribe(() => {
                          for (let id of ids) {
                            delete this.checked[id];
                            this.configs.splice(this.configs.findIndex(c => c.id == id), 1);
                            if (this.selected == id) {
                              this.selected = undefined;
                              this.select.emit(null);
                            }
                          }
                        });
  }

  workerEnabled(config: Config, value: string): boolean {
    return config.values.workers.indexOf(value) != -1;
  }

  // table summary string for the worker (column) config (row)
  //FIXME how to avoid the horrible switch?
  //FIXME consider, instead of config.values.workers, having an 'enabled' switch in each config.values.rds etc.
  configSummary(config: Config, worker: any) {
    if (! config.values.workers.includes(worker.value)) {
      // show that the worker is not enabled
      return '✘';
    }
    let key = worker.value;
    let values = config.values[key];
    if (values == undefined) return '✔'; // best we can do now is show that the worker is enabled
    switch (key) {
    case 'hamlib':
      if (values.freqs[0].enabled) {
        let range = values.freqs[0].range;
        let exp = values.freqs[0].exp;
        let hz = this.stateService.constants.hz_labels[exp];
        return `${range[0]} - ${range[1]} (Δ ${range[2]}) ${hz}`;
      }
      let bits = [];
      for (let freq of values.freqs.filter(f => f.enabled)) {
        let hz = this.stateService.constants.hz_labels[freq.exp];
        bits.push(`${freq.freq}${hz}`);
        if (bits.length == 2) {
          bits.push('…');
          break;
        }
      }
      return bits.join(' ');
    case 'rds':
      if (values.scan.enabled) {
        return `Scan (FM band)`;
      }
      if (values.freqs[1].enabled) {
        return `Static (${values.freqs[1].freq}MHz)`;
      }
    case 'ams':
    case 'sdr':
      let range = values.freqs[0].range;
      let exp = values.freqs[0].exp;
      let hz = this.stateService.constants.hz_labels[exp];
      return `${range[0]} - ${range[1]} (Δ ${range[2]}) ${hz}`;
    default:
      return '✔';
    }
  }

  audioEnabled(config: Config, worker: any) {
    if (! config.values.workers.includes(worker.value)) {
      return false;
    }
    let values = config.values[worker.value];
    return values != undefined && values.audio != undefined && values.audio.enabled;
  }

  running(config: Config): boolean {
    return config.id == this.config_id;
  }
}
