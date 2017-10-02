import { Component, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';
import { BytesPipe } from './bytes.pipe';

@Component({
  selector: 'psm-stats',
  template: `<psm-widget title="Data Storage">
              <form>
                <div class="form-group">
                  <label for="path">Data size</label>
                  <input readonly type="text" class="form-control" value="{{stats.size | bytes}}">
                </div>
                <div class="form-group">
                  <label for="path">Audio storage</label>
                  <input readonly type="text" class="form-control" value="{{stats.audio | bytes}}">
                </div>
                <div class="form-group">
                  <label for="path">Available storage</label>
                  <input readonly type="text" class="form-control" value="{{stats.free | bytes}}">
                </div>
              </form>
            </psm-widget>`
})
export class StatsComponent {
  stats: any = { };

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.widgetComponent.busy(this.dataService.getStats())
                        .subscribe(stats => this.stats = stats);
  }
}
