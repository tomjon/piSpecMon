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
                Play <input type="number" min="1" step="1" [(ngModel)]="n" /> second of audio from:
                <button (click)="onClick('L')">Left</button>
                <button (click)="onClick('R')">Right</button>
              </div>
             </psm-widget>`,
  directives: [ WidgetComponent, InputDirective ],
  styles: ['input[type=number] { width: 40px }']
})
export class AudioComponent extends WidgetBase {
  //FIXME can this go on a Widget parent class? probably only after moving to Angular 4...
  @ViewChild(WidgetComponent) widgetComponent;

  @ViewChild('audioL') L;
  @ViewChild('audioR') R;

  private n: number = 1;

  //FIXME boo :(
  constructor(dataService: DataService, stateService: StateService) { super(dataService, stateService) }

  //FIXME this also gets copy pasted everywhere...
  ngOnInit() {
    this.setViewChildren('audio', this.widgetComponent);
  }

  onClick(channel) {
    let audio = this[channel].nativeElement;
    let qs = `?n=${this.n}&x=${Date.now()}`; // the Date.now() is a cache buster
    audio.src = this.dataService.getAudioUrl(channel) + qs;
    audio.load();
    audio.play();
  }
}
