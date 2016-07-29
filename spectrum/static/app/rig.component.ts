import { Component, Input } from '@angular/core';
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
  _loading: number = 0;
  show: boolean = true;

  constructor(private dataService: DataService) { }

  toggle() {
    this.show = ! this.show;
  }

  ngOnInit() {
    this._loading += 2;
    this.dataService.getModels()
                    .subscribe(
                      models => this.models = models.sort(modelSort),
                      () => { },
                      () => --this._loading
                    );
    this.dataService.getRig()
                    .subscribe(
                      rig => this.rig = rig,
                      () => { },
                      () => --this._loading
                    );
  }

  onSubmit() {
    ++this._loading;
    this.dataService.setRig(this.rig)
                    .subscribe(
                      () => { },
                      () => { },
                      () => --this._loading
                    );
  }

  get loading(): boolean {
    return this._loading > 0;
  }
}
