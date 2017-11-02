import { Component, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { StateService } from './state.service';
import { WidgetBase } from './widget.base';

@Component({
  selector: 'psm-audio',
  template: `
    <psm-widget title="Live Audio">
      <div [hidden]="true">
        <audio #audioL controls preload="none"></audio>
        <audio #audioR controls preload="none"></audio>
      </div>
      <div class="form-group">
        Stream audio from:
        <button (click)="onClick('L')">{{label('L')}}</button>
        <button (click)="onClick('R')">{{label('R')}}</button>
      </div>
    </psm-widget>`,
  styles: ['input[type=number] { width: 40px }']
})
export class AudioComponent extends WidgetBase {
  @ViewChild('audioL') L;
  @ViewChild('audioR') R;

  private n: number = 1;

  constructor (private dataService: DataService, private stateService: StateService) { super() }

  label(channel): string {
    return this.stateService.constants.channel_label[channel];
  }

  onClick(channel) {
    let audio = this[channel].nativeElement;
    if (! audio.paused) {
      audio.pause();
      return;
    }
    let qs = `?x=${Date.now()}`; //FIXME the Date.now() is a cache buster; is this needed now we are streaming? (try and see)
    audio.src = this.dataService.getAudioUrl(channel) + qs;
    audio.load();
    audio.play();
  }
}
