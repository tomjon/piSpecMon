import { Component, Input, Output, ViewChild, EventEmitter } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { DataService } from './data.service';
import { dt_format } from './d3_import';
import { HZ_LABELS } from './constants';

@Component({
  selector: 'psm-table',
  directives: [ WidgetComponent ],
  templateUrl: 'templates/table.html'
})
export class TableComponent {
  @Input() modes: any[] = [ ];
  @Output('edit') edit = new EventEmitter();

  sets: any[] = [ ];
  checked: any = { };
  selected: string;

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.widgetComponent.busy(this.dataService.getSweepSets())
                        .subscribe(sets => this.sets = sets);
  }

  onSelect(config_id, e) {
    if (e.target.tagName != 'INPUT') {
      this.selected = this.selected == config_id ? undefined : config_id;
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
                            this.sets.splice(this.sets.find(s => s.config_id == id), 1);
                          });
    }
  }

  onView() {

  }

  onEdit() {
    for (let set of this.sets) {
      if (set.config_id == this.selected) {
        this.edit.emit(set.fields);
      }
    }
    delete this.selected;
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
