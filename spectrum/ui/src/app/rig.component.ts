import { Component, Input, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { StateService } from './state.service';
import { WidgetBase } from './widget.base';
import { WidgetComponent } from './widget.component';

@Component({
  selector: 'psm-rig',
  template:
    `<psm-widget title="Hamlib Receiver Configuration">
       <form role="form" #form="ngForm">
         <div class="form-group">
           <label for="model">Model</label>
           <select class="form-control" psmInput [(ngModel)]="values.model" name="model">
             <option *ngFor="let model of caps.models" value="{{model.model}}">{{model.manufacturer}} {{model.name}} v{{model.version}} ({{model.status}})</option>
           </select>
         </div>
         <div class="form-group">
           <div class="psm-input-group">
             <label for="data">Data bits</label>
             <input psmInput type="number" pattern="[0-9]+" min="1" max="8" step="1" class="form-control" required [(ngModel)]="values.data_bits" name="data" #data="ngModel">
           </div>
           <div class="psm-input-group">
             <label for="rate">Rate</label>
             <select class="form-control" psmInput [(ngModel)]="values.rate" name="rate">
               <option *ngFor="let rate of caps.rates" value="{{rate.value}}">{{rate.label}}</option>
             </select>
           </div>
         </div>
         <div [hidden]="data.valid || data.pristine" class="alert alert-danger">
           Data bits is a required parameter, and must be an integer
         </div>
         <div class="form-group">
           <div class="psm-input-group">
             <label for="stop">Stop bits</label>
             <input psmInput type="number" min="1" max="2" step="0.5" class="form-control" required [(ngModel)]="values.stop_bits" name="stop" #stop="ngModel">
           </div>
           <div class="psm-input-group">
             <label for="parity">Parity</label>
             <select class="form-control" psmInput [(ngModel)]="values.parity" name="parity">
               <option *ngFor="let parity of caps.parities" value="{{parity.value}}">{{parity.label}}</option>
             </select>
           </div>
         </div>
         <div [hidden]="stop.valid || stop.pristine" class="alert alert-danger">
           Stop bits is a required parameter
         </div>
         <div class="form-group">
           <div class="psm-input-group">
             <label for="delay">Write delay (ms)</label>
             <input psmInput type="number" min="0" pattern="[0-9]+" required class="form-control" [(ngModel)]="values.write_delay" name="delay" #delay="ngModel">
           </div>
           <div class="psm-input-group">
             <label for="interval">Retry interval (ms)</label>
             <input psmInput type="number" min="0" pattern="[0-9]+" required class="form-control" [(ngModel)]="values.interval" name="interval" #interval="ngModel">
           </div>
         </div>
         <div [hidden]="delay.valid || delay.pristine" class="alert alert-danger">
           Write delay is a required parameter, and must be an integer
         </div>
         <div [hidden]="interval.valid || interval.pristine" class="alert alert-danger">
           Retry interval is a required parameter, and must be an integer
         </div>
         <div class="form-group">
           <label for="attempts">Set frequency attempts</label>
           <select psmInput class="form-control" [(ngModel)]="values.set_check" name="attempts">
             <option value="0">Set once only</option>
             <option value="1">Set once and check</option>
             <option value="2">Set and check up to twice</option>
             <option value="3">Set and check up to three times</option>
           </select>
         </div>
         <div class="form-group">
           <label for="retries">Error handling</label>
           <select psmInput class="form-control" [(ngModel)]="values.retries" name="retries">
             <option value="0">Fail on error</option>
             <option value="1">Wait and retry once</option>
             <option value="2">Wait and retry twice</option>
             <option value="3">Wait and retry three times</option>
           </select>
         </div>
         <div class="form-group">
           <div class="psm-input-group">
             <label for="radio_on">Radio on attempts</label>
             <select psmInput class="form-control" [(ngModel)]="values.radio_on" name="radio_on">
               <option value="0">Never</option>
               <option value="1">Try once</option>
               <option value="2">Try twice</option>
               <option value="3">Try three times</option>
               <option value="*">Try forever</option>
             </select>
           </div>
           <div class="psm-input-group">
             <label for="attenuation">Attenuation</label>
             <select psmInput class="form-control" [(ngModel)]="values.attenuation" name="attenuation">
               <option value="true">On</option>
               <option value="false">Off</option>
             </select>
           </div>
         </div>
       </form>
     </psm-widget>`
})
export class RigComponent extends WidgetBase {
  @Input() caps; //FIXME this should probably be on state service?

  //FIXME can this go on a Widget parent class? probably only after moving to Angular 4...
  @ViewChild(WidgetComponent) widgetComponent;

  constructor(dataService: DataService, stateService: StateService) { super(dataService, stateService) }

  ngOnInit() {
    this.setViewChildren('rig', this.widgetComponent, 'hamlib');
  }
}
