import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { DataService } from './data.service';

@Injectable()
export class StatusService {

  // an observable for status updates
  private statusUpdates: Subject<any> = new Subject<any>();

  constructor (private dataService: DataService) {}

  public run(tick_interval: number) {
    setInterval(this.monitor.bind(this), tick_interval);
  }

  private monitor() {
    this.dataService.getStatus()
                    .subscribe(
                      status => this.statusUpdates.next(status),
                      error => window.location.assign('/')
                    );
  }

  public subscribe(f) {
    return this.statusUpdates.subscribe(f);
  }

}
