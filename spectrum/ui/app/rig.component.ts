import { Component, Input, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';

@Component({
  selector: 'psm-rig',
  templateUrl: 'templates/rig.html',
  directives: [ WidgetComponent ]
})
export class RigComponent {
  @Input() caps;
  rig: any = { };

  @ViewChild(WidgetComponent) widgetComponent;
  @ViewChild('rigForm') rigForm;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.onReset();
  }

  onReset() {
    this.widgetComponent.busy(this.dataService.getRig())
                        .subscribe(rig => this.rig = rig);
    if (this.rigForm) this.widgetComponent.pristine(this.rigForm);
  }

  onSubmit() {
    this.widgetComponent.busy(this.dataService.setRig(this.rig))
                        .subscribe();
    this.widgetComponent.pristine(this.rigForm);
  }

  get loading() {
    return this.widgetComponent.loading;
  }
}
