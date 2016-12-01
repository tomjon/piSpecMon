import { Component } from '@angular/core';
import { HTTP_PROVIDERS } from '@angular/http';
import { DataService } from './data.service';
import { PsmComponent } from './psm.component';
import { EventComponent } from './event.component';

// Add the RxJS Observable operators we need in this app
import './rxjs-operators';

export var TICK_INTERVAL = 2000;

@Component({
  selector: 'overseer-app',
  template: `<h1>PSM Overseer</h1>
             <table>
               <tr *ngFor="let psm of data">
                 <td><overseer-psm psm="psm"></overseer-psm></td>
                 <td>
                   <ol *ngFor="let event of psm.events">
                     <li><overseer-event event="event"></overseer-event></li>
                   </ol>
                 </td>
               </tr>
             </table>`,
  directives: [PsmComponent, EventComponent],
  providers: [DataService, HTTP_PROVIDERS]
})
export class AppComponent {
  data: any = [];

  constructor(private dataService: DataService) { }

  ngOnInit() {
    setInterval(this.load.bind(this), TICK_INTERVAL);
  }

  load() {
    this.dataService.getData()
                    .subscribe(
                      data => this.data = data,
                      error => window.location.assign('/')
                    );
  }
}
