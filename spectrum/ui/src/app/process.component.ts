import { Component } from '@angular/core';
import { DataService } from './data.service';
import { StateService } from './state.service';
import { StatusService } from './status.service';

@Component({
  selector: 'psm-process',
  template: `
    <psm-widget title="Processes">
      <psm-status *ngFor="let worker of activeWorkers" [status]="status[worker.value]" [label]="worker.label" [values]="values[worker.value]"></psm-status>
      <div class="form-group">
        <div *ngFor="let worker of workers">
          <input [disabled]="running || ! workerAvailable(worker)" type="checkbox" class="toggle" [(ngModel)]="worker.enabled" [name]="worker.value"/>
          <label [attr.for]="worker.value">{{worker.label}}</label>
        </div>
        <div [hidden]="validWorkers" class="alert alert-danger">
          At least one worker must be selected to start a job
        </div>
        <label for="description">Description</label>
        <input [disabled]="running" type="text" class="form-control" [(ngModel)]="description" name="description"/>
      </div>
      <button (click)="onStart()" class="btn btn-default" [disabled]="! canStart">Start</button>
      <button (click)="onStop()" class="btn btn-default" [disabled]="! canStop">Stop</button>
    </psm-widget>`,
  styles: ["button { margin-bottom: 10px }"]
})
export class ProcessComponent {
  private status: any = {};

  private description: string;
  private workers: any[] = [];
  private activeWorkers: any[] = [];

  constructor(private dataService: DataService,
              private stateService: StateService,
              statusService: StatusService) {
    statusService.subscribe(status => {
      this.status = status;
      this.activeWorkers = [];
      for (let worker of this.workers) {
        if (! this.workerAvailable(worker)) worker.enabled = false;
        let s = this.status[worker.value];
        if (s != undefined && (s.timestamp || s.error)) {
          this.activeWorkers.push(worker);
        }
      }
    });
  }

  ngOnInit() {
    this.workers = this.stateService.getWorkers();
  }

  // return the config values of the currently running job (if any)
  private get values(): any {
    return this.running ? this.stateService.runningConfig.values : {};
  }

  private workerAvailable(worker: any): boolean {
    return this.status[worker.value] != undefined && this.status[worker.value].error == undefined;
  }

  get running(): boolean {
    return this.stateService.runningConfig != undefined;
  }

  get validWorkers(): boolean {
    return this.workers.filter(w => w.enabled).length > 0;
  }

  get canStart(): boolean {
    if (! this.validWorkers) return false;
    return ! this.running && this.stateService.isPristine;
  }

  get canStop(): boolean {
    return this.running;
  }

  onStart() {
//    this.standby = true;
    let workers = this.workers.filter(w => w.enabled).map(w => w.value);
    this.dataService.start(workers, this.description)
                    .subscribe();
  }

  onStop() {
//    this.standby = true;
    this.dataService.stop()
                    .subscribe();
  }
}
