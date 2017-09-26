import { Component, Input, ViewChild } from '@angular/core';
import { StateService } from './state.service';
import { DataService } from './data.service';
import { WidgetBase } from './widget.base';
import { WidgetComponent } from './widget.component';
import { Config } from './config';
import { DatePipe } from './date.pipe';
import { InputDirective } from './input.directive';

@Component({
  selector: 'psm-rds',
  template: `<psm-widget title="Monkeyboard Scanner">
              <form role="form" #form="ngForm" novalidate>
                <div class="form-group">
                  <label for="scan_mode">Scan Mode</label>
                  <input psmInput type="checkbox" (ngModelChange)="staticEnabled = scanEnabled" [(ngModel)]="scanEnabled" class="toggle" name="scan_mode">
                  <div>
                    <div class="psm-input-group col-lg-6">
                      <label for="strength_threshold">Strength threshold</label>
                      <input psmInput [disabled]="! scanEnabled" type="number" pattern="[0-9]+" required class="form-control" [(ngModel)]="values.scan.strength_threshold" name="strength_threshold" #strength_threshold="ngModel">
                    </div>
                    <div class="psm-input-group col-lg-6">
                      <label for="strength_timeout">Strength timeout (s)</label>
                      <input psmInput [disabled]="! scanEnabled" type="number" pattern="[0-9]+" required class="form-control" [(ngModel)]="values.scan.strength_timeout" name="strength_timeout" #strength_timeout="ngModel">
                    </div>
                  </div>
                  <div>
                    <div class="psm-input-group col-lg-6">
                      <label for="name_timeout">Name timeout (s)</label>
                      <input psmInput [disabled]="! scanEnabled" type="number" pattern="[0-9]+" required class="form-control" [(ngModel)]="values.scan.name_timeout" name="name_timeout" #name_timeout="ngModel">
                    </div>
                    <div class="psm-input-group col-lg-6">
                      <label for="text_timeout">Text timeout (s)</label>
                      <input psmInput [disabled]="! scanEnabled" type="number" pattern="[0-9]+" required class="form-control" [(ngModel)]="values.scan.text_timeout" name="text_timeout" #text_timeout="ngModel">
                    </div>
                  </div>
                </div>
                <div [hidden]="strength_threshold.valid || strength_threshold.pristine" class="alert alert-danger">
                  Strength threshold is a required integer parameter
                </div>
                <div [hidden]="strength_timeout.valid || strength_timeout.pristine" class="alert alert-danger">
                  Strength timeout is a required integer parameter
                </div>
                <div [hidden]="name_timeout.valid || name_timeout.pristine" class="alert alert-danger">
                  Name timeout is a required parameter
                </div>
                <div [hidden]="text_timeout.valid || text_timeout.pristine" class="alert alert-danger">
                  Text timeout is a required parameter
                </div>
                <div class="form-group">
                  <label for="static_mode">Static Mode</label>
                  <input psmInput type="checkbox" (ngModelChange)="scanEnabled = staticEnabled" [(ngModel)]="staticEnabled" class="toggle" name="static_mode">
                  <div>
                    <label for="frequency">Frequency (MHz)</label>
                    <input psmInput [disabled]="! staticEnabled" type="number" required class="form-control" [(ngModel)]="values.freqs[1].freq" name="frequency" #frequency="ngModel">
                  </div>
                </div>
                <div [hidden]="frequency.valid || frequency.pristine" class="alert alert-danger">
                  Frequency is a required parameter
                </div>
                <div class="form-group">
                  <div class="psm-input-group col-lg-6">
                    <label for="duration">Dwell (s)</label>
                    <input psmInput type="number" pattern="[0-9]+" required class="form-control" [(ngModel)]="values.duration" name="duration" #duration="ngModel">
                  </div>
                  <div class="psm-input-group col-lg-6">
                    <label for="audio">Collect audio</label>
                    <select psmInput class="form-control" [(ngModel)]="values.audio.enabled" name="audio">
                      <option [ngValue]="true">On</option>
                      <option [ngValue]="false">Off</option>
                    </select>
                  </div>
                </div>
                <div [hidden]="duration.valid || duration.pristine" class="alert alert-danger">
                  Sample duration is a required integer parameter
                </div>
              </form>
            </psm-widget>`
})
export class RdsComponent extends WidgetBase {
  units: any[] = [];

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(dataService: DataService, stateService: StateService) { super(dataService, stateService) }

  ngOnInit() {
    //FIXME repeated code from scan.component.ts
    let hz = this.stateService.constants.hz_labels;
    for (let value in hz) {
      this.units.push({ value: value, label: hz[value] });
    }
    this.setViewChildren('rds', this.widgetComponent, 'rds');
  }

  get scanEnabled(): boolean {
    return this.values.scan.enabled;
  }

  set scanEnabled(value: boolean) {
    this.values.scan.enabled = value;
    this.values.freqs[0].enabled = value;
  }

  get staticEnabled(): boolean {
    return this.values.freqs[1].enabled;
  }

  set staticEnabled(value: boolean) {
    this.values.freqs[1].enabled = value;
  }
}
