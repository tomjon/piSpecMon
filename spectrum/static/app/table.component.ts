import { Component, Input, Output, ViewChild, EventEmitter } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { MessageService } from './message.service';
import { DataService } from './data.service';
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
  @Output('select') select = new EventEmitter<Config>();

  sets: Config[] = [ ];
  checked: any = { };
  selected: string;

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(private dataService: DataService, private messageService: MessageService) { }

  ngOnInit() {
    this.widgetComponent.busy(this.dataService.getSweepSets())
                        .subscribe(sets => this.sets = sets);
  }

  onSelect(config_id, e) {
    if (e.target.tagName != 'INPUT') {
      this.selected = this.selected == config_id ? undefined : config_id;
      for (let set of this.sets) {
        if (set.config_id == this.selected) {
          this.select.emit(set);
          return;
        }
      }
      this.select.emit(null);
    }
  }

  checkedIds(): string[] {
    let ids = [ ];
    for (let id in this.checked) {
      if (this.checked[id]) ids.push(id);
    }
    return ids;
  }

  onCheckAll() {
    for (let s of this.sets) {
      this.checked[s.config_id] = true;
    }
  }

  onCheckNone() {
    this.checked = { };
  }

  onDelete() {
    //FIXME need to overhaul server API - and provide a way to delete multiple sweep sets in one go
    for (let id of this.checkedIds()) {
      this.widgetComponent.busy(this.dataService.deleteSweepSet(id))
                          .subscribe(() => {
                            delete this.checked[id];
                            this.sets.splice(this.sets.findIndex(s => s.config_id == id), 1);
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
