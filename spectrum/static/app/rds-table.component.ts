import { Component, Input } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { DatePipe } from './date.pipe';
import { Data } from './data';

@Component({
  selector: 'psm-rds-table',
  directives: [ WidgetComponent ],
  pipes: [ DatePipe ],
  template: `<psm-widget [hidden]="isHidden()" title="RDS Text" class="chart">
               <form class="form-inline" role="form">
                 <div class="form-group">
                   <label for="station">Station</label>
                   <select class="form-control" [(ngModel)]="idx" name="station">
                     <option *ngFor="let station of stations" [value]="station.idx">{{station.name}}</option>
                   </select>
                 </div>
               </form>
               <table *ngIf="data && data.rdsText[idx]">
                 <tr>
                   <th>Timestamp</th>
                   <th>Text</th>
                 </tr>
                 <tr *ngFor="let entry of data.rdsText[idx]">
                   <td>{{entry.timestamp | date}}</td>
                   <td>{{entry.text}}
                 </tr>
               </table>
               <div *ngIf="data && ! data.rdsText[idx]">
                 No RDS text decoded
               </div>
             </psm-widget>`
})
export class RdsTableComponent {
  data: Data;
  stations: any;
  idx: number; // the selected station index

  @Input('data') set _data(data: Data) {
    this.data = data;
    this.stations = [];
    if (data && data.rdsNames) {
      for (let idx in data.rdsNames) {
        this.stations.push({ 'idx': idx, 'name': data.rdsNames[idx] });
      }
    }
  }

  isHidden() {
    return this.stations == undefined || this.stations.length == 0;
  }
}
