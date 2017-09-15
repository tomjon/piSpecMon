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
  directives: [ WidgetComponent ],
  pipes: [ DatePipe, UnitsPipe ],
  templateUrl: 'templates/table.html',
  styles: ['.scan-cap { text-transform: capitalize }']
})
export class TableComponent {
  @Input() user: User;
  @Output('select') select = new EventEmitter<Config>();

  configs: Config[] = [ ];
  checked: any = { };
  selected: string;

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
    for (let key in status) {
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
      let max_count = 0;
      let max_latest = 0;
      for (let key in status) {
        //FIXME there is probably a nicer way to do this max stuff
        if (status[key].sweep) {
          max_count = Math.max(max_count, status[key].sweep.sweep_n);
          max_latest = Math.max(max_latest, status[key].sweep.timestamp);
        }
      }
      config.count = max_count;
      config.latest = max_latest;
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

  onExport() {
    this.widgetComponent.busy(this.dataService.exportData(this.selected, this.rds))
                        .subscribe(path => this.messageService.show('CSV written to ' + path));
  }

  onDownload() {
    let args = this.rds ? '?rds=true' : '';
    window.open('/export/' + this.selected + args, '_blank');
  }

  workerEnabled(config: Config, value: string): boolean {
    return config.values.workers.indexOf(value) != -1;
  }

  running(config: Config): boolean {
    return config.id == this.config_id;
  }
}
