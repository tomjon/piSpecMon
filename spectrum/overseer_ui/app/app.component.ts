import { Component, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { HTTP_PROVIDERS } from '@angular/http';

// Add the RxJS Observable operators we need in this app
import './rxjs-operators';

export var TICK_INTERVAL = 2000;

@Component({
  selector: 'overseer-app',
  template: `<h1>PSM Overseer<h1>
             <table>
               <tr *ngFor="let psm of data">
                 <td>{{psm.name}}</td>
                 <td>{{psm.heartbeat}}</td>
               </tr>
             </table>`,
  directives: [],
  providers: [DataService, HTTP_PROVIDERS],
  pipes: []
})
export class AppComponent {
  data: any;

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
