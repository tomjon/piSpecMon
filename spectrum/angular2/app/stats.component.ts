import { Component, Input } from '@angular/core';
import { ErrorComponent } from './error.component';
import { DataService } from './data.service';
import { BytesPipe } from './bytes.pipe';

@Component({
  selector: 'psm-stats',
  templateUrl: 'templates/stats.html',
  providers: [ DataService ],
  pipes: [ BytesPipe ]
})
export class StatsComponent {
  title = "Elasticsearch Index";
  stats: any = { };

  @Input('error') errorComponent: ErrorComponent;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.dataService.getStats()
                    .subscribe(
                      stats => this.stats = stats,
                      error => this.errorComponent.add(error)
                    );
  }
}
