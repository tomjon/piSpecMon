import { Component, Input } from '@angular/core';
import { StateService } from './state.service';
import { WidgetComponent } from './widget.component';
import { FreqPipe } from './freq.pipe';
import { DatePipe } from './date.pipe';
import { Data } from './data';
import { Chart } from './chart';

@Component({
  selector: 'psm-sample-table',
  inputs: [ 'worker' ],
  directives: [ WidgetComponent ],
  pipes: [ DatePipe, FreqPipe ],
  template: `<psm-widget [hidden]="isHidden" title="{{label}} - Audio Samples" class="chart" (show)="onShow($event)">
               <form *ngIf="data != undefined" class="form-inline" role="form">
                 <div class="form-group">
                   <label for="idx">Frequency</label>
                   <select class="form-control" [(ngModel)]="freq_n" name="idx">
                     <option *ngFor="let freq_n of freqs" [value]="freq_n">{{freq_n | freq:values.rds}}</option>
                   </select>
                 </div>
               </form>
               <table *ngIf="data != undefined && data.samples[freq_n] && data.samples[freq_n].length > 0">
                 <tr>
                   <th>Timestamp</th>
                   <th>Sample</th>
                 </tr>
                 <tr *ngFor="let sample of data.samples[freq_n].slice().reverse()">
                   <td>{{sample.timestamp | date}}</td>
                   <td><audio controls src="{{sample.path}}" preload="none"></audio></td>
                 </tr>
               </table>
               <div *ngIf="data != undefined && (! data.samples[freq_n] || data.samples[freq_n].length == 0)">
                 No audio samples recorded at selected frequency
               </div>
             </psm-widget>`
})
export class SampleTableComponent extends Chart {
  freqs: number[];
  freq_n: number;

  constructor(stateService: StateService) { super(stateService) } //FIXME superclass has stuff we don't want, and we don't call the super constructor properly

  plot() {
    this.freqs = [];
    for (let freq_n in this.data.samples) {
      if (! Number.isNaN(+freq_n)) this.freqs.push(+freq_n); //FIXME NaN check because we added a length property!
    }
    if (this.freq_n == undefined && this.freqs.length > 0) this.freq_n = this.freqs[0];
  }

  get isHidden(): boolean {
    return this.data == undefined || this.values.audio.enabled == false || this.data.samples.length == 0;
  }

  get values(): any {
    return this.stateService.currentConfig != undefined ? this.stateService.currentConfig.values : undefined;
  }
}
