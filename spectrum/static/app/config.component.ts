import { Component, Input } from '@angular/core';
import { DataService } from './data.service';
import { Config } from './config';
import { DEFAULTS } from './constants';

var DEFAULT_CONFIG = new Config('', 0, DEFAULTS);

@Component({
  selector: 'psm-config',
  templateUrl: 'templates/config.html'
})
export class ConfigComponent {
  modes: any = [ ];
  config: Config = DEFAULT_CONFIG;

  @Input('config_id') config_id : string;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.dataService.getModes()
                    .subscribe(
                      modes => { this.modes = modes },
                      () => { }
                    );
  }

  ngOnChanges() {
    if (this.config_id) {
      this.dataService.getConfig(this.config_id)
                      .subscribe(
                        config => { delete config.config.rig; this.config = config },
                        () => { }
                      );
    } else {
      this.config = DEFAULT_CONFIG;
    }
  }

  onSubmit() {
    // never called - no submit button, but ngSubmit supresses page reload
  }
}
