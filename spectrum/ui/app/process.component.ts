import { Component, ViewChild, Input } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';
import { StateService } from './state.service';
import { FreqPipe } from './freq.pipe';
import { DatePipe } from './date.pipe';

@Component({
  selector: 'psm-process',
  directives: [ WidgetComponent ],
  pipes: [ FreqPipe, DatePipe ],
  template: `<psm-widget title="Processes">
               <form role="form">
                 <div *ngIf="rds && (rds.timestamp || rds.error)" [ngClass]="{ status: true, error: rds.error != undefined }">
                   <h2 *ngIf="rds.timestamp">{{label('rds')}} status at {{rds.timestamp | date}}</h2>
                   <span *ngIf="rds.sweep">Scan {{rds.sweep.sweep_n + 1}} started at {{rds.sweep.timestamp | date}}</span>
                   <span *ngIf="rds.freq_n != undefined && values != undefined">Receiving on {{rds.freq_n | freq:values.rds}}</span>
                   <span *ngIf="rds.strength != undefined">Strength: {{rds.strength}}</span>
                   <span *ngIf="rds.name">Station name: {{rds.name}}</span>
                   <span *ngIf="rds.text"><i>{{rds.text}}</i></span>
                   <span *ngIf="rds.error">{{rds.error}}</span>
                 </div>
                 <div *ngIf="hamlib && (hamlib.config_id || hamlib.error)" [ngClass]="{ status: true, error: hamlib.error != undefined }">
                   <h2 *ngIf="hamlib.timestamp">{{label('hamlib')}} status at {{hamlib.timestamp | date}}</h2>
                   <div *ngIf="hamlib.sweep">
                     <span>Scan {{hamlib.sweep.sweep_n + 1}} started at {{hamlib.sweep.timestamp | date}}</span>
                     <span *ngFor="let peak of hamlib.sweep.peaks">Peak {{peak.strength}}dB at {{peak.freq_n | freq:values.hamlib}}</span>
                     <span *ngIf="hamlib.sweep.previous">{{hamlib.sweep.previous.strength}}dB at {{hamlib.sweep.previous.freq_n | freq:values.hamlib}}</span>
                     <span *ngIf="hamlib.sweep.current">Reading strength at {{hamlib.sweep.current.freq_n | freq:values.hamlib}}...</span>
                     <span *ngIf="hamlib.sweep.record">Recording audio sample at {{hamlib.sweep.record.freq_n | freq:values.hamlib}}...</span>
                   </div>
                   <span *ngIf="hamlib.error">{{hamlib.error}}</span>
                 </div>
                 <div class="form-group">
                   <div *ngFor="let worker of workers">
                     <input [disabled]="running" type="checkbox" class="toggle" [(ngModel)]="worker.enabled" [name]="worker.value"/>
                     <label [attr.for]="worker.value">{{worker.label}}</label>
                   </div>
                   <label for="description">Description</label>
                   <input [disabled]="running" type="text" class="form-control" [(ngModel)]="description" name="description"/>
                 </div>
                 <div [hidden]="validWorkers" class="alert alert-danger">
                   At least one worker must be selected to start a job
                 </div>
                 <button (click)="onStart()" class="btn btn-default" [disabled]="! showStart">Start</button>
                 <button (click)="onStop()" class="btn btn-default" [disabled]="! showStop">Stop</button>
               </form>
             </psm-widget>`
})
export class ProcessComponent {
  @Input() status: any;
  @Input() values: any; //FIXME make this available from state service (so table info goes into the service)

  @ViewChild(WidgetComponent) widgetComponent;

  private _description: string;
  private workers: any[] = [];

  constructor(private dataService: DataService, private stateService: StateService) {}

  ngOnInit() {
    this.workers = this.stateService.getWorkers();
  }

  private label(value: string): string {
    let worker = this.workers.find(w => w.value == value);
    return worker != undefined ? worker.label : '[unknown worker]';
  }

  get rds(): any {
    return this.status['rds'];
  }

  get hamlib(): any {
    return this.status['hamlib'];
  }

  get running(): boolean {
    for (let key in this.status) {
      if (this.status[key].config_id) return true;
    }
    return false;
  }

  get description(): string {
    return this.running ? this.values.description : this._description;
  }

  set description(value: string) {
    this._description = value;
  }

  get validWorkers(): boolean {
    return this.workers.filter(w => w.enabled).length > 0;
  }

  get showStart(): boolean {
    if (! this.validWorkers) return false;
    for (let widget of this.stateService.widgets) {
      if (! widget.isPristine) return false;
    }
    return ! this.running;
  }

  get showStop(): boolean {
    return this.running;
  }

  onStart() {
//    this.standby = true;
    let workers = this.workers.filter(w => w.enabled).map(w => w.value);
    this.dataService.start(workers, this._description)
                    .subscribe();
  }

  onStop() {
//    this.standby = true;
    this.dataService.stop()
                    .subscribe();
  }
}
