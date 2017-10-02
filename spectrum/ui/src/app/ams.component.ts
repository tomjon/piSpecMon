import { Component } from '@angular/core';
import { WidgetBase } from './widget.base';

@Component({
  selector: 'psm-ams',
  template: `
    <psm-widget key="ams" title="Keysight Configuration">
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
      <psm-freq-range [range]="values.freqs[0]"></psm-freq-range>
    </psm-widget>`
})
export class AmsComponent extends WidgetBase {
}
