import { Component, Input } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { dt_format } from './d3_import';

@Component({
  selector: 'psm-rds-table',
  directives: [ WidgetComponent ],
  template: `<psm-widget [hidden]="isHidden()" title="RDS Text" class="chart">
               <form class="form-inline" role="form">
                 <div class="form-group">
                   <label for="station">Station</label>
                   <select class="form-control" [(ngModel)]="idx" name="station">
                     <option *ngFor="let station of stations" [value]="station.idx">{{station.name}}</option>
                   </select>
                 </div>
               </form>
               <table *ngIf="text[idx]">
                 <tr><th>Timestamp</th><th>Text</th></tr>
                 <tr *ngFor="let entry of text[idx]">
                   <td>{{time(entry)}}</td><td>{{entry.text}}
                 </tr>
               </table>
               <div *ngIf="! text[idx]">
                 No RDS text decoded
               </div>
             </psm-widget>`
})
export class RdsTableComponent {
  stations: any;
  @Input() text: any;

  idx: number; // the selected station index

  constructor() { }

  isHidden() {
    return this.stations == undefined || this.stations.length == 0;
  }

  @Input('names') set _rdsNames(rdsNames) {
    this.stations = [];
    for (let idx in rdsNames) {
      this.stations.push({ 'idx': idx, 'name': rdsNames[idx] });
    }
  }

  private time(entry: any) {
    return dt_format(new Date(entry.timestamp));
  }
}
