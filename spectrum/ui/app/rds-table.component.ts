import { Component, Input } from '@angular/core';
import { StateService } from './state.service';
import { WidgetComponent } from './widget.component';
import { DatePipe } from './date.pipe';
import { Data } from './data';
import { Chart } from './chart';

@Component({
  selector: 'psm-rds-table',
  inputs: [ 'worker' ],
  directives: [ WidgetComponent ],
  pipes: [ DatePipe ],
  template: `<psm-widget [hidden]="isHidden" title="{{label}} - RDS Text" class="chart" (show)="onShow($event)">
               <form class="form-inline" role="form">
                 <div class="form-group">
                   <label for="station">Station</label>
                   <select class="form-control" [(ngModel)]="idx" name="station">
                     <option *ngFor="let station of stations" [value]="station.idx">{{station.name}}</option>
                   </select>
                 </div>
               </form>
               <table *ngIf="data != undefined && data.rdsText[idx]">
                 <tr>
                   <th>Timestamp</th>
                   <th>Text</th>
                 </tr>
                 <tr *ngFor="let entry of data.rdsText[idx].slice().reverse()">
                   <td>{{entry.timestamp | date}}</td>
                   <td>{{entry.text}}
                 </tr>
               </table>
               <div *ngIf="data != undefined && ! data.rdsText[idx]">
                 No RDS text decoded for the selected station
               </div>
             </psm-widget>`
})
export class RdsTableComponent extends Chart {
  stations: any;
  idx: number; // the selected station index

  constructor(stateService: StateService) { super(stateService) } //FIXME doesn't call super correctly... superclass has stuff we don't need

  plot() {
    this.stations = [];
    if (this.data && this.data.rdsNames) {
      for (let idx in this.data.rdsNames) {
        if (this.idx == undefined) this.idx = +idx;
        this.stations.push({ 'idx': idx, 'name': this.data.rdsNames[idx] });
      }
    }
    if (this.idx == undefined && this.stations.length > 0) this.idx = this.stations[0].idx;
  }

  get isHidden(): boolean {
    return this.data == undefined || this.stations == undefined || this.stations.length == 0;
  }
}
