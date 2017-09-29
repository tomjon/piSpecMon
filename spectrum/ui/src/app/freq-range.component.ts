import { Component, Input } from '@angular/core';
import { StateService } from './state.service';

declare var $;

@Component({
  selector: 'psm-freq-range',
  template: `
    <div class="form-group">
      <label>Frequency Range</label>
      <ng-content></ng-content>
      <div>
        <div class="psm-input-group-4">
          <input psmInput [disabled]="disabled" type="text" required class="form-control" [(ngModel)]="range.range[0]" name="start" #start="ngModel">
          <div class="help">start</div>
        </div>
        <div class="psm-input-group-4">
          <input psmInput [disabled]="disabled" type="text" required class="form-control" [(ngModel)]="range.range[1]" name="end" #end="ngModel">
          <div class="help">end</div>
        </div>
        <div class="psm-input-group-4">
          <input psmInput [disabled]="disabled" type="text" required class="form-control" [(ngModel)]="range.range[2]" name="step" #step="ngModel">
          <div class="help">step</div>
        </div>
        <div class="psm-input-group-4">
          <select psmInput [disabled]="disabled" class="form-control" [(ngModel)]="range.exp" name="units">
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
    </div>`
})
export class FreqRangeComponent {
  @Input() range: any;
  @Input() disabled: boolean;

  units: any[] = [];

  constructor(private stateService: StateService) {}

  ngOnInit() {
    let hz = this.stateService.constants.hz_labels;
    for (let value in hz) {
      this.units.push({ value: value, label: hz[value] });
    }
  }

  numeric(v: any): boolean {
    return $.isNumeric(v);
  }

  validNumber(input: any): boolean {
    return (input.valid && $.isNumeric(input.model)) || input.pristine;
  }

  get validRange(): boolean {
    return +(this.range.range[0]) + +(this.range.range[2]) <= +(this.range.range[1]);
  }
}
