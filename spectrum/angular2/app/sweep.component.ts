import { Component, Input } from '@angular/core';
import { ErrorComponent } from './error.component';
import { DataService } from './data.service';

declare var d3: any;

var hz = { 0: 'Hz', 3: 'kHz', 6: 'MHz', 9: 'GHz' };

@Component({
  selector: 'psm-sweep',
  templateUrl: 'templates/sweep.html'
})
export class SweepComponent {
  config_id: string = ''; // currently selected sweep set
  sets: any[] = [ ];
  date_format: Function;
  waiting: boolean = false; // true when waiting for server interaction to complete

  @Input('error') errorComponent: ErrorComponent;

  constructor(private dataService: DataService) {
    this.date_format = d3.time.format('%d/%m/%Y %X'); //FIXME use a date pipe instead
  }

  ngOnInit() {
    this.reload(false);
  }

  public reload(selectLast: boolean) {
    this.dataService.getSweepSets()
                    .subscribe(
                      sets => { this.sets = sets; if (selectLast) this.selectLast() },
                      error => this.errorComponent.add(error)
                    );
  }

  onExport() {
    this.waiting = true;
    this.dataService.exportData(this.config_id)
                    .subscribe(
                      path => { this.waiting = false; alert('CSV written to ' + path) },
                      error => { this.waiting = false; this.errorComponent.add(error) }
                    );
  }

  onDownload() {
    //FIXME note, this won't work until the app is being served by Apache / Flask (otherwise need different domain)
    window.open('/export/' + this.config_id, '_blank');
  }

  onDelete() {
    this.waiting = true;
    this.dataService.deleteSweepSet(this.config_id)
                    .subscribe( //FIXME is there any way to do { waiting = false } more elegantly? appears lots in different files
                      () => { this.waiting = false; this.removeSet(this.config_id) },
                      error => { this.waiting = false; this.errorComponent.add(error) }
                    );
  }

  private removeSet(config_id) {
    for (let i = 0; i < this.sets.length; ++i) {
      if (this.sets[i].config_id == config_id) {
        this.sets.splice(i, 1);
        break;
      }
    }
    this.config_id = '';
  }

  public getTimestamp() {
    for (let set of this.sets) {
      if (set.config_id == this.config_id) {
        return set.timestamp;
      }
    }
    return undefined;
  }

  private selectLast() {
    this.config_id = this.sets[this.sets.length - 1].config_id;
  }

  private format(set): string {
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
