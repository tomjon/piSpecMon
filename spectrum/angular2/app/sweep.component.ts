import { Component, Input } from '@angular/core';
import { ErrorComponent } from './error.component';
import { DataService } from './data.service';

declare var d3: any;

var hz = { 0: 'Hz', 3: 'kHz', 6: 'MHz', 9: 'GHz' };

@Component({
  selector: 'psm-sweep',
  templateUrl: 'templates/sweep.html',
  providers: [ DataService ]
})
export class SweepComponent {
  config_id: string = '';
  sets: any[] = [ ];
  date_format: Function;

  @Input('error') errorComponent: ErrorComponent;

  constructor(private dataService: DataService) {
    this.date_format = d3.time.format('%d/%m/%Y %X');
  }

  ngOnInit() {
    this.dataService.getSweepSets()
                    .subscribe(
                      sets => this.sets = sets,
                      error => this.errorComponent.add(error)
                    );
  }

  onDelete() {
    this.dataService.deleteSweepSet(this.config_id)
                    .subscribe(
                      () => this.removeSet(this.config_id),
                      error => this.errorComponent.add(error)
                    );
  }

  removeSet(config_id) {
    for (var i = 0; i < this.sets.length; ++i) {
      if (this.sets[i].config_id == config_id) {
        this.sets.splice(i, 1);
        break;
      }
    }
    this.config_id = '';
  }

  format(set): string {
    let time = new Date(set.timestamp);
    let s = this.date_format(time) + '   ';
    let config = set.fields;
    if (config.freqs.range) {
      let u = hz[config.freqs.exp];
      s += config.freqs.range[0] + u + ' - ' + config.freqs.range[1] + u;
    } else if (config.freqs.freqs) {
      let freqs = config.freqs.freqs;
      for (let idx = 0; idx < freqs.length; ++idx) {
        s += freqs[idx].f + hz[freqs[idx].exp];
        if (idx < config.freqs.freqs.length - 1) {
          s += ', ';
        }
        if (idx > 2) {
          s += '...';
          break;
        }
      }
    }
    return s;
  }
}
