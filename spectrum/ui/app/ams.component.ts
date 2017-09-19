import { Component, Input, ViewChild } from '@angular/core';
import { StateService } from './state.service';
import { DataService } from './data.service';
import { WidgetBase } from './widget.base';
import { WidgetComponent } from './widget.component';
import { Config } from './config';
import { User } from './user';
import { DatePipe } from './date.pipe';
import { FreqPipe } from './freq.pipe';
import { InputDirective } from './input.directive';

declare var $;

@Component({
  selector: 'psm-ams',
  template: `<psm-widget title="AMS Configuration">
              <form role="form" #form="ngForm" novalidate>
                <div class="form-group">
                  <div class="psm-input-group col-lg-6">
                    <label for="address">Sensor Address</label>
                    <input psmInput type="text" required class="form-control" [(ngModel)]="values.address" name="address" #address="ngModel">
                  </div>
                  <div class="psm-input-group col-lg-6">
                    <label for="port">Sensor Port</label>
                    <input psmInput type="number" required class="form-control" [(ngModel)]="values.port" name="port" #port="ngModel">
                  </div>
                </div>
                <div class="form-group">
                  <div>
                    <div class="psm-input-group col-lg-3">
                      <input psmInput type="text" required class="form-control" [(ngModel)]="values.freqs[0].range[0]" name="start" #start="ngModel">
                      <div class="help">start</div>
                    </div>
                    <div class="psm-input-group col-lg-3">
                      <input psmInput type="text" required class="form-control" [(ngModel)]="values.freqs[0].range[1]" name="end" #end="ngModel">
                      <div class="help">end</div>
                    </div>
                    <div class="psm-input-group col-lg-3">
                      <input psmInput type="text" required class="form-control" [(ngModel)]="values.freqs[0].range[2]" name="step" #step="ngModel">
                      <div class="help">step</div>
                    </div>
                    <div class="psm-input-group col-lg-3">
                      <select psmInput class="form-control" [(ngModel)]="values.freqs[0].exp" name="units">
                        <option *ngFor="let u of units" value="{{u.value}}">{{u.label}}</option>
                      </select>
                      <div class="help">units</div>
                    </div>
                  </div>
                  <div [hidden]="validNumber(start) && validNumber(end) && validNumber(step)" class="alert alert-danger">
                    Frequency range is a required parameter, and must consist of numbers
                  </div>
                  <div [hidden]="! validNumber(start) || ! validNumber(end) || ! validNumber(step) || validRange" class="alert alert-danger">
                    Invalid range: end frequency must be greater than start frequency
                  </div>
                </div>
              </form>
            </psm-widget>`,
  directives: [ WidgetComponent, InputDirective ],
  pipes: [ DatePipe, FreqPipe ]
})
export class AmsComponent extends WidgetBase {
  units: any[] = [];

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(dataService: DataService, stateService: StateService) { super(dataService, stateService) }

  ngOnInit() {
    //FIXME copy code
    let hz = this.stateService.constants.hz_labels;
    for (let value in hz) {
      this.units.push({ value: value, label: hz[value] });
    }
    this.setViewChildren('ams', this.widgetComponent, 'ams');
  }

  numeric(v): boolean {
    return $.isNumeric(v);
  }

  validNumber(input): boolean {
    return (input.valid && $.isNumeric(input.model)) || input.pristine;
  }

  get validRange(): boolean {
    return +(this.values.freqs[0].range[0]) + +(this.values.freqs[0].range[2]) <= +(this.values.freqs[0].range[1]);
  }
}
