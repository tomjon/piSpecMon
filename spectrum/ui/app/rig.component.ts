import { Component, Input, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { StateService } from './state.service';
import { WidgetBase } from './widget.base';
import { WidgetComponent } from './widget.component';

@Component({
  selector: 'psm-rig',
  templateUrl: 'templates/rig.html',
  directives: [ WidgetComponent ]
})
export class RigComponent extends WidgetBase {
  @Input() caps; //FIXME this should probably be on state service?

  //FIXME can this go on a Widget parent class? probably only after moving to Angular 4...
  @ViewChild(WidgetComponent) widgetComponent;

  constructor(dataService: DataService, stateService: StateService) { super(dataService, stateService) }

  ngOnInit() {
    this.setViewChildren('rig', this.widgetComponent);
  }
}
