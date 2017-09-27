import { Component, Input, ViewChild } from '@angular/core';
import { StateService } from './state.service';
import { DataService } from './data.service';
import { WidgetBase } from './widget.base';
import { WidgetComponent } from './widget.component';

declare var $;

@Component({
  selector: 'psm-sdr',
  template: `<psm-widget title="SDRPlay Configuration">
              <form role="form" #form="ngForm" novalidate>
                <div class="form-group">
                  <label for="antenna">Antenna</label>
                  <select required psmInput class="form-control" [(ngModel)]="values.scan.antenna" name="antenna" #antenna="ngModel">
                    <option *ngFor="let o of caps.antenna" value="{{o.value}}">{{o.label}}</option>
                  </select>
                </div>
                <div [hidden]="antenna.valid" class="alert alert-danger">
                  Select an antenna
                </div>
                <div class="form-group">
                  <label>Frequency Range</label>
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
            </psm-widget>`
})
export class SdrComponent extends WidgetBase {
  units: any[] = [];

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(dataService: DataService, stateService: StateService) { super(dataService, stateService) }

  ngOnInit() {
    //FIXME copy code - lots of template (for frequency range) also copied
    let hz = this.stateService.constants.hz_labels;
    for (let value in hz) {
      this.units.push({ value: value, label: hz[value] });
    }
    this.setViewChildren('sdr', this.widgetComponent, 'sdr');
  }

  //FIXME following three functions are copy-code
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