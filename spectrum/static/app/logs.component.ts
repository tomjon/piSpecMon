import { Component, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';

@Component({
  selector: 'psm-logs',
  directives: [ WidgetComponent ],
  template: `<psm-widget title="System Logs">
               <form role="form">
                 <div class="form-group">
                   <div class="psm-input-group col-lg-6">
                     <label for="n">Tail size</label>
                     <input type="number" pattern="[0-9]+" min="1" step="1" class="form-control" required [(ngModel)]="tail_n" name="n" #n="ngModel">
                   </div>
                   <div class="psm-input-group col-lg-6">
                     <label for="level">Level</label>
                     <select class="form-control" [(ngModel)]="filter" name="level">
                       <option value="">All</option>
                       <option value="DEBUG">DEBUG</option>
                       <option value="INFO">INFO</option>
                       <option value="WARN">WARN</option>
                       <option value="ERROR">ERROR</option>
                     </select>
                   </div>
                 </div>
                 <div [hidden]="n.valid || n.pristine" class="alert alert-danger">
                   Number of lines to tail is a required parameter, and must be an integer
                 </div>
                 <div class="form-group">
                   <button class="btn btn-default" (click)="onClick('psm-wsgi')">Server</button>
                   <button class="btn btn-default" (click)="onClick('psm-worker')">Spectrum scan</button>
                   <button class="btn btn-default" (click)="onClick('psm-monkey')">RDS scan</button>
                 </div>
               </form>
             </psm-widget>`
})
export class LogsComponent {
  tail_n: number = 10;
  filter: string = "";

  onClick(log: string) {
    let filter = this.filter != "" ? `&level=${this.filter}` : "";
    window.open(`/log/${log}?n=${this.tail_n}${filter}`);
  }
}
