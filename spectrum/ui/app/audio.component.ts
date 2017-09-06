import { Component, Input, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { StateService } from './state.service';
import { WidgetBase } from './widget.base';
import { WidgetComponent } from './widget.component';

@Component({
  selector: 'psm-audio',
  templateUrl: 'templates/audio.html',
  directives: [ WidgetComponent ]
})
export class AudioComponent extends WidgetBase {
  //FIXME can this go on a Widget parent class? probably only after moving to Angular 4...
  @ViewChild(WidgetComponent) widgetComponent;

  //FIXME boo :(
  constructor(dataService: DataService, stateService: StateService) { super(dataService, stateService) }

  //FIXME this also gets copy pasted everywhere...
  ngOnInit() {
    this.setViewChildren('audio', this.widgetComponent);
  }
}
