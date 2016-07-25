import { Component, Input } from '@angular/core';
import { DataService } from './data.service';
import { ErrorService } from './error.service';

let modelSort = function (a, b) {
  if (a.manufacturer == b.manufacturer) {
    return a.name < b.name ? -1 : 1;
  } else {
    return a.manufacturer < b.manufacturer ? -1 : 1;
  }
};

@Component({
  selector: 'psm-rig',
  templateUrl: 'templates/rig.html'
})
export class RigComponent {
  title = "Rig Configuration";
  models: any = [ ];
  rig: any = { };

  constructor(private dataService: DataService, private errorService: ErrorService) { }

  ngOnInit() {
    this.dataService.getModels()
                    .subscribe(
                      models => this.models = models.sort(modelSort),
                      error => this.errorService.logError(this, error)
                    );
    this.dataService.getRig()
                    .subscribe(
                      rig => { this.rig = rig },
                      error => this.errorService.logError(this, error)
                    );
  }

  onChange() {
    this.dataService.setRig(this.rig)
                    .subscribe(
                      () => { },
                      error => this.errorService.logError(this, error)
                    );
  }

  onSubmit() {
    // never called - no submit button, but ngSubmit supresses page reload
  }
}
