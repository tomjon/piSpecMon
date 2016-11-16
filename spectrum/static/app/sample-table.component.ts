import { Component, Input } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { FreqPipe } from './freq.pipe';
import { DatePipe } from './date.pipe';
import { Data } from './data';

@Component({
  selector: 'psm-sample-table',
  directives: [ WidgetComponent ],
  pipes: [ DatePipe, FreqPipe ],
  template: `<psm-widget [hidden]="isHidden()" title="Audio Samples" class="chart">
               <form class="form-inline" role="form">
                 <div class="form-group">
                   <label for="idx">Frequency</label>
                   <select class="form-control" [(ngModel)]="freq_n" name="idx">
                     <option *ngFor="let freq_n of freqs" [value]="freq_n">{{freq_n | freq:config}}</option>
                   </select>
                 </div>
               </form>
               <table *ngIf="samples[freq_n] && samples[freq_n].length > 0">
                 <tr>
                   <th>Timestamp</th>
                   <th>Sample</th>
                 </tr>
                 <tr *ngFor="let sample of samples[freq_n].slice().reverse()">
                   <td>{{sample.timestamp | date}}</td>
                   <td><audio controls src="{{sample.path}}" preload="none"></audio></td>
                 </tr>
               </table>
               <div *ngIf="samples[freq_n] && samples[freq_n].length == 0">
                 No audio samples recorded
               </div>
             </psm-widget>`
})
export class SampleTableComponent {
  freqs: number[] = [];
  samples: any = {};
  freq_n: number;

  @Input() config: any;

  @Input('data') set _data(data: Data) {
    if (! data) return;
    this.freqs = [];
    this.samples = data.samples;
    for (let freq_n in this.samples) {
      this.freqs.push(+freq_n);
    }
  }

  isHidden() {
    return this.freqs.length == 0;
  } 
}
