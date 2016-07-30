import { Component, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';
import { BytesPipe } from './bytes.pipe';

@Component({
  selector: 'psm-stats',
  templateUrl: 'templates/stats.html',
  directives: [ WidgetComponent ],
  pipes: [ BytesPipe ]
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
