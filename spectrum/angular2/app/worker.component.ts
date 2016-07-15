import { Component, Input } from '@angular/core';
import { SweepComponent } from './sweep.component';
import { ErrorComponent } from './error.component';
import { DataService } from './data.service';

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
  @Input('error') errorComponent: ErrorComponent;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    //FIXME is there some angular2 helper for this kind of thing? though, this seems simple enough
    setInterval(this.monitor.bind(this), 1000); //FIXME constant
  }

  monitor() {
    this.dataService.getMonitor()
                    .subscribe(
                      data => {
                        this.error = data.error;
                        this.config_id = data.config_id;
                        this.last_sweep = 1000 * data.last_sweep;
                      },
                      error => this.errorComponent.add(error)
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
                      () => { this.waiting = false; this.sweepComponent.reload(true) },
                      error => { this.waiting = false; this.errorComponent.add(error) } //FIXME can this be done in the UI - i.e. add a row to the select?
                    );
  }

  onStop() {
    this.waiting = true;
    this.dataService.stopMonitor()
                    .subscribe(
                      () => this.waiting = false,
                      error => { this.waiting = false; this.errorComponent.add(error) }
                    );
  }
}
