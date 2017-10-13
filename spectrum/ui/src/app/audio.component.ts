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
        Play <input type="number" min="1" step="1" [(ngModel)]="n" /> second of audio from:
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
    let qs = `?n=${this.n}&x=${Date.now()}`; // the Date.now() is a cache buster
    audio.src = this.dataService.getAudioUrl(channel) + qs;
    audio.load();
    audio.play();
  }
}
