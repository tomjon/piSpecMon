import { Component, Input } from '@angular/core';
import { SweepComponent } from './sweep.component';
import { DataService } from './data.service';
import { TICK_INTERVAL } from './constants';

@Component({
  selector: 'psm-worker',
  templateUrl: 'templates/worker.html'
})
export class WorkerComponent {
  error: string;
  config_id: string; // if the worker is scanning, this is the current config_id
  last_sweep: number; // and this is the timestamp of the last sweep
  waiting: boolean = false; // true when waiting for server interaction to complete

  @Input('config') config: any;
  @Input('sweep') sweepComponent: SweepComponent;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    setInterval(this.monitor.bind(this), TICK_INTERVAL);
  }

  monitor() {
    this.dataService.getMonitor()
                    .subscribe(
                      data => {
                        this.error = data.error;
                        this.config_id = data.config_id;
                        this.last_sweep = Math.floor(1000 * data.last_sweep);
                      },
                      error => window.location.assign('/') //FIXME handle the error as usual, then redirect? (this effectively logs out)
                    );
  }

  mayStart() {
    return ! this.waiting && this.error == undefined && this.config_id == undefined;
  }

  mayStop() {
    return ! this.waiting && this.error == undefined && this.config_id != undefined;
  }

  onStart() {
    this.waiting = true;
    this.dataService.startMonitor(this.config)
                    .subscribe(
                      () => this.sweepComponent.reload(true),
                      () => { },
                      () => this.waiting = false
                    );
  }

  onStop() {
    this.waiting = true;
    this.dataService.stopMonitor()
                    .subscribe(
                      () => { },
                      () => { },
                      () => this.waiting = false
                    );
  }
}
