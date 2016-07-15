import { Component, Input } from '@angular/core';
import { ErrorComponent } from './error.component';
import { DataService } from './data.service';

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

  @Input('error') errorComponent: ErrorComponent;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.dataService.getModels()
                    .subscribe(
                      models => this.models = models.sort(modelSort),
                      error => this.errorComponent.add(error)
                    );
    this.dataService.getRig()
                    .subscribe(
                      rig => { this.rig = rig },
                      error => this.errorComponent.add(error)
                    );
  }

  onChange() {
    this.dataService.setRig(this.rig)
                    .subscribe(
                      () => { },
                      error => this.errorComponent.add(error)
                    );
  }

  onSubmit() {
    // never called - no submit button, but ngSubmit supresses page reload
  }
}
