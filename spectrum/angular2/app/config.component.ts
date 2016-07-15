import { Component, Input } from '@angular/core';
import { ErrorComponent } from './error.component';
import { DataService } from './data.service';

var DEFAULTS = {
                 freqs: { range: [87.5, 108, 0.1], exp: 6 },
                 monitor: { period: 0, radio_on: 1 },
                 scan: { mode: 64 }
               };

@Component({
  selector: 'psm-config',
  templateUrl: 'templates/config.html'
})
export class ConfigComponent {
  modes: any = [ ];
  config: any = DEFAULTS;

  @Input('error') errorComponent: ErrorComponent;
  @Input('config_id') config_id : string;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.dataService.getModes()
                    .subscribe(
                      modes => { this.modes = modes },
                      error => this.errorComponent.add(error)
                    );
  }

  ngOnChanges() {
    if (this.config_id) {
      this.dataService.getConfig(this.config_id)
                      .subscribe(
                        config => { delete config.rig; this.config = config },
                        error => this.errorComponent.add(error)
                      );
    } else {
      this.config = DEFAULTS;
    }
  }

  onChange() {
    // FIXME: if unused, remove (change) handler
  }

  onSubmit() {
    // never called - no submit button, but ngSubmit supresses page reload
  }
}
