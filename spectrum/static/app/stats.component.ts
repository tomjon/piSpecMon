import { Component, Input } from '@angular/core';
import { DataService } from './data.service';
import { BytesPipe } from './bytes.pipe';

@Component({
  selector: 'psm-stats',
  templateUrl: 'templates/stats.html',
  pipes: [ BytesPipe ]
})
export class StatsComponent {
  title = "Elasticsearch Index";
  stats: any = { };

  _loading: number = 0;
  show: boolean = true;

  constructor(private dataService: DataService) { }

  toggle() {
    this.show = ! this.show;
  }

  ngOnInit() {
    ++this._loading;
    this.dataService.getStats()
                    .subscribe(
                      stats => this.stats = stats,
                      () => { },
                      () => --this._loading
                    );
  }

  get loading(): boolean {
    return this._loading > 0;
  }
}
