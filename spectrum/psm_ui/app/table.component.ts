import { Component, Input, Output, ViewChild, EventEmitter } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { MessageService } from './message.service';
import { DataService } from './data.service';
import { User } from './user';
import { Config } from './config';
import { DatePipe } from './date.pipe';
import { UnitsPipe } from './units.pipe';

@Component({
  selector: 'psm-table',
  directives: [ WidgetComponent ],
  pipes: [ DatePipe, UnitsPipe ],
  templateUrl: 'templates/table.html'
})
export class TableComponent {
  @Input() modes: any[] = [ ];
  @Input() user: User;
  @Output('select') select = new EventEmitter<Config>();

  configs: Config[] = [ ];
  checked: any = { };
  selected: string;

  // true when waiting for (real) status after startup
  standby: boolean = true;

  // id of the running config set, if any
  config_id: string;

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(private dataService: DataService, private messageService: MessageService) { }

  @Input('status') set _status(status) {
    if (status == undefined) return;
    this.standby = false;
    this.config_id = status.worker.config_id || status.monkey.config_id;
    if (! this.config_id) return;

    let config: Config = this.configs.find(set => set.id == this.config_id);
    if (! config) {
      // if we are seeing a new config, add it to the table
      this.widgetComponent.busy(this.dataService.getConfig(this.config_id))
                          .subscribe(config => this.configs.push(config[0]));
    } else {
      // otherwise, update the one we have
      if (status.worker.sweep) {
        config.count = status.worker.sweep.sweep_n;
        if (status.worker.sweep.timestamp) {
          config.latest = status.worker.sweep.timestamp;
        }
      }
    }
  }

  ngOnInit() {
    this.widgetComponent.busy(this.dataService.getConfig())
                        .subscribe(configs => this.configs = configs);
  }

  onSelect(config_id, e) {
    if (e.target.tagName != 'INPUT') {
      this.selected = this.selected == config_id ? undefined : config_id;
      this.select.emit(this.getConfig(this.selected));
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
    this.widgetComponent.busy(this.dataService.exportData(this.selected))
                        .subscribe(path => this.messageService.show('CSV written to ' + path));
  }

  onDownload() {
    window.open('/export/' + this.selected, '_blank');
  }

  mode(value): string {
    for (let m of this.modes) {
      if (m.mode == value) {
        return m.name;
      }
    }
    return null;
  }

  get loading() {
    return this.widgetComponent.loading;
  }

  running(config: Config): boolean {
    return config.id == this.config_id;
  }
}
