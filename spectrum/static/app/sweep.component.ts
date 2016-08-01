import { Component, Input } from '@angular/core';
import { DataService } from './data.service';
import { HZ_LABELS } from './constants';
import { dt_format } from './d3_import';

@Component({
  selector: 'psm-sweep',
  templateUrl: 'templates/sweep.html'
})
export class SweepComponent {
  config_id: string = ''; // currently selected sweep set
  sets: any[] = [ ];
  waiting: boolean = false; // true when waiting for server interaction to complete

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.reload(false);
  }

  public reload(selectLast: boolean) {
    this.dataService.getSweepSets()
                    .subscribe(
                      sets => { this.sets = sets; if (selectLast) this.selectLast() },
                      () => { }
                    );
  }

  onExport() {
    this.waiting = true;
    this.dataService.exportData(this.config_id)
                    .subscribe(
                      path => alert('CSV written to ' + path),
                      () => { },
                      () => this.waiting = false
                    );
  }

  onDownload() {
    window.open('/export/' + this.config_id, '_blank');
  }

  onDelete() {
    this.waiting = true;
    this.dataService.deleteSweepSet(this.config_id)
                    .subscribe(
                      () => this.removeSet(this.config_id),
                      () => { },
                      () => this.waiting = false
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

  private selectLast() {
    //this.config_id = this.sets[this.sets.length - 1].config_id;
  }

  private format(set): string {
    let time = new Date(set.timestamp);
    let s = dt_format(time) + '   ';
    let config = set.fields;
    if (config.freqs.range) {
      let u = HZ_LABELS[config.freqs.exp];
      s += config.freqs.range[0] + u + ' - ' + config.freqs.range[1] + u;
    } else if (config.freqs.freqs) {
      let freqs = config.freqs.freqs;
      for (let idx = 0; idx < freqs.length; ++idx) {
        s += freqs[idx].f + HZ_LABELS[freqs[idx].exp];
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
