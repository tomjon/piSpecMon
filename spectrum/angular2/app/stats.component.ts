import { Component, Input } from '@angular/core';
import { DataService } from './data.service';
import { ErrorService } from './error.service';
import { BytesPipe } from './bytes.pipe';

@Component({
  selector: 'psm-stats',
  templateUrl: 'templates/stats.html',
  pipes: [ BytesPipe ]
})
export class StatsComponent {
  title = "Elasticsearch Index";
  stats: any = { };

  constructor(private dataService: DataService, private errorService: ErrorService) { }

  ngOnInit() {
    this.dataService.getStats()
                    .subscribe(
                      stats => this.stats = stats,
                      error => this.errorService.logError(this, error)
                    );
  }
}
