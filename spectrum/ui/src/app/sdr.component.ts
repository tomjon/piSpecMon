import { Component } from '@angular/core';
import { WidgetBase } from './widget.base';

@Component({
  selector: 'psm-sdr',
  template: `<psm-widget key="sdr" title="SDRPlay Configuration">
              <div class="form-group">
                <label for="antenna">Antenna</label>
                <select required psmInput class="form-control" [(ngModel)]="values.scan.antenna" name="antenna" #antenna="ngModel">
                  <option *ngFor="let o of caps.antenna" value="{{o.value}}">{{o.label}}</option>
                </select>
              </div>
              <div [hidden]="antenna.valid" class="alert alert-danger">
                Select an antenna
              </div>
              <psm-freq-range [range]="values.freqs[0]"></psm-freq-range>
            </psm-widget>`
})
export class SdrComponent extends WidgetBase {
}
