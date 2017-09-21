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
              <div [hidden]="true">
                <audio #audioL controls preload="none"></audio>
                <audio #audioR controls preload="none"></audio>
              </div>
              <div class="form-group">
                <label>Play one second of audio from:</label>
                <button (click)="onClick('L')">Left</button>
                <button (click)="onClick('R')">Right</button>
              </div>
             </psm-widget>`,
  directives: [ WidgetComponent, InputDirective ]
})
export class AudioComponent extends WidgetBase {
  //FIXME can this go on a Widget parent class? probably only after moving to Angular 4...
  @ViewChild(WidgetComponent) widgetComponent;

  @ViewChild('audioL') L;
  @ViewChild('audioR') R;

  //FIXME boo :(
  constructor(dataService: DataService, stateService: StateService) { super(dataService, stateService) }

  //FIXME this also gets copy pasted everywhere...
  ngOnInit() {
    this.setViewChildren('audio', this.widgetComponent);
  }

  onClick(channel) {
    let audio = this[channel].nativeElement;
    audio.src = this.dataService.getAudioUrl(channel) + '?' + Date.now();
    audio.load();
    audio.play();
  }
}
