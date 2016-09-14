import { Component, Input, Output, ViewChild, EventEmitter } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { MessageService } from './message.service';
import { DataService } from './data.service';
import { User } from './user';
import { Config } from './config';
import { dt_format } from './d3_import';
import { HZ_LABELS } from './constants';

@Component({
  selector: 'psm-table',
  directives: [ WidgetComponent ],
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

  config_id: string;

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(private dataService: DataService, private messageService: MessageService) { }

  @Input('status') set _status(status) {
    if (status == undefined) return;
    this.standby = false;
    this.config_id = status.config_id;
    if (status.config_id && ! this.configs.find(set => set.id == status.config_id)) {
      this.widgetComponent.busy(this.dataService.getConfig(status.config_id))
                          .subscribe(config => this.configs.push(config));
    }
  }

  ngOnInit() {
    this.widgetComponent.busy(this.dataService.getConfigs())
                        .subscribe(configs => this.configs = configs);
  }

  onSelect(config_id, e) {
    if (e.target.tagName != 'INPUT') {
      this.selected = this.selected == config_id ? undefined : config_id;
      this.select.emit(this.getConfig(this.selected));
    }
  }

  private getConfig(config_id: string): Config {
    for (let config of this.configs) {
      if (config.id == config_id) {
        return config;
      }
    }
    return null;
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
    //FIXME need to provide a way to delete multiple sweep sets in one go
    for (let id of this.checkedIds()) {
      this.widgetComponent.busy(this.dataService.deleteConfig(id))
                          .subscribe(() => {
                            delete this.checked[id];
                            this.configs.splice(this.configs.findIndex(c => c.id == id), 1);
                          });
    }
  }

  onExport() {
    this.widgetComponent.busy(this.dataService.exportData(this.selected))
                        .subscribe(path => this.messageService.show('CSV written to ' + path));
  }

  onDownload() {
    window.open('/export/' + this.selected, '_blank');
  }

  formatTime(timestamp): string {
    return dt_format(new Date(timestamp));
  }

  mode(value): string {
    for (let m of this.modes) {
      if (m.mode == value) {
        return m.name;
      }
    }
    return null;
  }

  units(value): string {
    return HZ_LABELS[value];
  }

  get loading() {
    return this.widgetComponent.loading;
  }
}
