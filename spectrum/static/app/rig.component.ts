import { Component, Input, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';

let modelSort = function (a, b) {
  if (a.manufacturer == b.manufacturer) {
    return a.name < b.name ? -1 : 1;
  } else {
    return a.manufacturer < b.manufacturer ? -1 : 1;
  }
};

@Component({
  selector: 'psm-rig',
  templateUrl: 'templates/rig.html',
  directives: [ WidgetComponent ]
})
export class RigComponent {
  models: any = [ ];
  rig: any = { };

  @ViewChild(WidgetComponent) widgetComponent;
  @ViewChild('rigForm') rigForm;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.widgetComponent.busy(this.dataService.getModels())
                        .subscribe(models => this.models = models.sort(modelSort));
    this.onReset();
  }

  onReset() {
    this.widgetComponent.busy(this.dataService.getRig())
                        .subscribe(rig => this.rig = rig);
    if (this.rigForm) this._pristine();
  }

  onSubmit() {
    this.widgetComponent.busy(this.dataService.setRig(this.rig))
                        .subscribe();
    this._pristine();
  }

  private _pristine(): void {
    this.rigForm.form['_touched'] = false;
    this.rigForm.form['_pristine'] = true;
  }
}
