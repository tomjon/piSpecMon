import { Component, ViewChild, Input } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';
import { StateService } from './state.service';
import { FreqPipe } from './freq.pipe';

@Component({
  selector: 'psm-process',
  directives: [ WidgetComponent ],
  pipes: [ FreqPipe ],
  template: `<psm-widget title="Processes">
               <form role="form">
                 <div *ngIf="monkey && (monkey.timestamp || monkey.error)" [ngClass]="{ status: true, error: monkey.error != undefined }">
                   <h2 *ngIf="monkey.timestamp">RDS status at {{monkey.timestamp | date}}</h2>
                   <span *ngIf="monkey.started">Scan started {{monkey.started | date}}</span>
                   <span *ngIf="monkey.sweep">Sweep {{monkey.sweep.sweep_n + 1}} started at {{monkey.sweep.timestamp | date}}</span>
                   <span *ngIf="monkey.freq_n != undefined && values != undefined">Receiving on {{monkey.freq_n | freq:values.rds}}</span>
                   <span *ngIf="monkey.strength != undefined">Strength: {{monkey.strength}}</span>
                   <span *ngIf="monkey.name">Station name: {{monkey.name}}</span>
                   <span *ngIf="monkey.text"><i>{{monkey.text}}</i></span>
                   <span *ngIf="monkey.error">{{monkey.error}}</span>
                 </div>
                 <div *ngIf="! running" class="message">
                   Not running
                 </div>
                 <button (click)="onStart()" class="btn btn-default" [disabled]="! showStart">Start</button>
                 <button (click)="onStop()" class="btn btn-default" [disabled]="! showStop">Stop</button>
               </form>
             </psm-widget>`
})
export class ProcessComponent {
  @Input() status: any;
  @Input() values: any;

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(private dataService: DataService, private stateService: StateService) {}

  get monkey(): any {
    return this.status.monkey;
  }

  get running(): boolean {
    if (! this.status) return false;
    if (this.status.worker && this.status.worker.config_id) return true;
    if (this.status.monkey && this.status.monkey.config_id) return true;
    return false;
  }

  get showStart(): boolean {
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
    this.dataService.start()
                    .subscribe();
  }

  onStop() {
//    this.standby = true;
    this.dataService.stop()
                    .subscribe();
  }
}
