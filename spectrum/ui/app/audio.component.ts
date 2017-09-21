import { Component, Input, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { StateService } from './state.service';
import { WidgetBase } from './widget.base';
import { WidgetComponent } from './widget.component';
import { InputDirective } from './input.directive';

@Component({
  selector: 'psm-audio',
  template: `<psm-widget title="Audio Configuration">
              <form role="form" #form="ngForm">
                <div class="form-group">
                  <label for="rate">Rate (samples /s)</label>
                  <select psmInput class="form-control" [(ngModel)]="values.rate" name="rate">
                    <option value="8000">8000</option>
                    <option value="11025">11025</option>
                    <option value="22050">22050</option>
                    <option value="44100">44100</option>
                    <option value="96000">96000</option>
                  </select>
                </div>
              </form>
              <div class="form-group">
                <audio controls src="{{url('L')}}" preload="none"></audio>
                <audio controls src="{{url('R')}}" preload="none"></audio>
              </div>
             </psm-widget>`,
  directives: [ WidgetComponent, InputDirective ]
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

  url(channel: string): string {
    this.dataService.getAudioUrl(channel);
  }
}
