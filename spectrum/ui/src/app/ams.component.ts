import { Component, Input, ViewChild } from '@angular/core';
import { StateService } from './state.service';
import { WidgetBase } from './widget.base';
import { WidgetComponent } from './widget.component';
import { Config } from './config';
import { User } from './user';

declare var $;

@Component({
  selector: 'psm-ams',
  template: `<psm-widget key="ams" title="Keysight Configuration">
              <div class="form-group">
                <div class="psm-input-group">
                  <label for="address">Sensor Address</label>
                  <input psmInput type="text" required class="form-control" [(ngModel)]="values.address" name="address" #address="ngModel">
                </div>
                <div class="psm-input-group">
                  <label for="port">Sensor Port</label>
                  <input psmInput type="number" required class="form-control" [(ngModel)]="values.port" name="port" #port="ngModel">
                </div>
              </div>
              <div [hidden]="address.valid" class="alert alert-danger">
                Sensor Address is a required parameter, and must be an IP address
              </div>
              <div [hidden]="port.valid" class="alert alert-danger">
                Sensor Port is a required parameter, and must be a port number
              </div>
              <div class="form-group">
                <div class="psm-input-group">
                  <label for="antenna">Antenna</label>
                  <select required psmInput class="form-control" [(ngModel)]="values.scan.antenna" name="antenna" #antenna="ngModel">
                    <option *ngFor="let o of caps.antenna" value="{{o.value}}">{{o.label}}</option>
                  </select>
                </div>
                <div class="psm-input-group">
                  <label for="preamp">Preamp</label>
                  <select required psmInput class="form-control" [(ngModel)]="values.scan.preamp" name="preamp" #preamp="ngModel">
                    <option *ngFor="let o of caps.preamp" value="{{o.value}}">{{o.label}}</option>
                  </select>
                </div>
              </div>
              <div [hidden]="antenna.valid" class="alert alert-danger">
                Select an antenna
              </div>
              <div [hidden]="preamp.valid" class="alert alert-danger">
                Select a preamp setting
              </div>
              <div class="form-group">
                <div class="psm-input-group">
                  <label for="attenuation">Attenuation</label>
                  <select required psmInput class="form-control" [(ngModel)]="values.scan.attenuation" name="attenuation" #attenuation="ngModel">
                    <option *ngFor="let o of caps.attenuation" value="{{o.value}}">{{o.label}}</option>
                  </select>
                </div>
                <div class="psm-input-group">
                  <label for="window">Window</label>
                  <select required psmInput class="form-control" [(ngModel)]="values.scan.window" name="window" #window="ngModel">
                    <option *ngFor="let o of caps.window" value="{{o.value}}">{{o.label}}</option>
                  </select>
                </div>
              </div>
              <div [hidden]="attenuation.valid" class="alert alert-danger">
                Select an attenuation setting
              </div>
              <div [hidden]="window.valid" class="alert alert-danger">
                Select a window setting
              </div>
              <div class="form-group">
                <label>Frequency Range</label>
                <div>
                  <div class="psm-input-group-4">
                    <input psmInput type="text" required class="form-control" [(ngModel)]="values.freqs[0].range[0]" name="start" #start="ngModel">
                    <div class="help">start</div>
                  </div>
                  <div class="psm-input-group-4">
                    <input psmInput type="text" required class="form-control" [(ngModel)]="values.freqs[0].range[1]" name="end" #end="ngModel">
                    <div class="help">end</div>
                  </div>
                  <div class="psm-input-group-4">
                    <input psmInput type="text" required class="form-control" [(ngModel)]="values.freqs[0].range[2]" name="step" #step="ngModel">
                    <div class="help">step</div>
                  </div>
                  <div class="psm-input-group-4">
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
            </psm-widget>`
})
export class AmsComponent extends WidgetBase {
  units: any[] = [];

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(stateService: StateService) { super(stateService) }

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
