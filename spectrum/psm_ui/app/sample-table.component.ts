import { Component, Input } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { FreqPipe } from './freq.pipe';
import { DatePipe } from './date.pipe';
import { Data } from './data';
import { Chart } from './chart';

@Component({
  selector: 'psm-sample-table',
  inputs: [ 'data', 'timestamp' ],
  directives: [ WidgetComponent ],
  pipes: [ DatePipe, FreqPipe ],
  template: `<psm-widget [hidden]="isHidden()" title="Audio Samples" class="chart" (show)="onShow($event)">
               <form class="form-inline" role="form">
                 <div class="form-group">
                   <label for="idx">Frequency</label>
                   <select class="form-control" [(ngModel)]="freq_n" name="idx">
                     <option *ngFor="let freq_n of freqs" [value]="freq_n">{{freq_n | freq:config}}</option>
                   </select>
                 </div>
               </form>
               <table *ngIf="data.samples[freq_n] && data.samples[freq_n].length > 0">
                 <tr>
                   <th>Timestamp</th>
                   <th>Sample</th>
                 </tr>
                 <tr *ngFor="let sample of data.samples[freq_n].slice().reverse()">
                   <td>{{sample.timestamp | date}}</td>
                   <td><audio controls src="{{sample.path}}" preload="none"></audio></td>
                 </tr>
               </table>
               <div *ngIf="! data.samples[freq_n] || data.samples[freq_n].length == 0">
                 No audio samples recorded at selected frequency
               </div>
             </psm-widget>`
})
export class SampleTableComponent extends Chart {
  freqs: number[] = [];
  freq_n: number;

  @Input() config: any;

  plot() {
    this.freqs = [];
    for (let freq_n in this.data.samples) {
      this.freqs.push(+freq_n);
    }
  }

  isHidden() {
    return this.data.samples.length == 0;
  }
}
