import { Component } from '@angular/core';
import { WidgetBase } from './widget.base';
import { StateService } from './state.service';

declare var $;

@Component({
  selector: 'psm-scan',
  template: `<psm-widget key="hamlib" title="Hamlib Receiver Scanner">
              <div class="form-group">
                <label [attr.for]="mode">Mode</label>
                <select psmInput class="form-control" [(ngModel)]="values.mode" name="mode">
                  <option *ngFor="let o of caps.modes" [value]="o.value">{{o.label}}</option>
                </select>
              </div>
              <div class="form-group">
                <label for="start">Frequency range</label>
                <input psmInput type="checkbox" (ngModelChange)="freqsEnabled = rangeEnabled" [(ngModel)]="rangeEnabled" class="toggle" name="range">
                <div>
                  <div class="psm-input-group-4">
                    <input psmInput [disabled]="! rangeEnabled" type="text" required class="form-control" [(ngModel)]="values.freqs[0].range[0]" name="start" #start="ngModel">
                    <div class="help">start</div>
                  </div>
                  <div class="psm-input-group-4">
                    <input psmInput [disabled]="! rangeEnabled" type="text" required class="form-control" [(ngModel)]="values.freqs[0].range[1]" name="end" #end="ngModel">
                    <div class="help">end</div>
                  </div>
                  <div class="psm-input-group-4">
                    <input psmInput [disabled]="! rangeEnabled" type="text" required class="form-control" [(ngModel)]="values.freqs[0].range[2]" name="step" #step="ngModel">
                    <div class="help">step</div>
                  </div>
                  <div class="psm-input-group-4">
                    <select psmInput class="form-control" [disabled]="! rangeEnabled" [(ngModel)]="values.freqs[0].exp" name="units">
                      <option *ngFor="let u of units" value="{{u.value}}">{{u.label}}</option>
                    </select>
                    <div class="help">units</div>
                  </div>
                </div>
                <div [hidden]="! rangeEnabled || (validNumber(start) && validNumber(end) && validNumber(step))" class="alert alert-danger">
                  Frequency range is a required parameter, and must consist of numbers
                </div>
                <div [hidden]="! rangeEnabled || ! validNumber(start) || ! validNumber(end) || ! validNumber(step) || validRange" class="alert alert-danger">
                  Invalid range: end frequency must be greater than start frequency
                </div>
              </div>
              <div class="form-group freqlist">
                <label>Discrete frequencies</label>
                <input psmInput type="checkbox" (ngModelChange)="rangeEnabled = freqsEnabled" [(ngModel)]="freqsEnabled" class="toggle" name="freqs">
                <div *ngFor="let freq of values.freqs; let n = index; let last = last">
                  <ng-container *ngIf="freq.range == undefined">
                    <div class="psm-input-group-4">
                      <input psmInput [disabled]="! freqsEnabled" type="text" required class="form-control" [(ngModel)]="freq.freq" name="value_{{n}}">
                      <div *ngIf="last" class="help">value</div>
                    </div>
                    <div class="psm-input-group-4">
                      <select psmInput class="form-control" [disabled]="! freqsEnabled" [(ngModel)]="freq.exp" name="units_{{n}}">
                        <option *ngFor="let u of units" value="{{u.value}}">{{u.label}}</option>
                      </select>
                      <div *ngIf="last" class="help">units</div>
                    </div>
                    <div class="psm-input-group-4">
                      <button class="form-control" [disabled]="! numeric(freq.freq) || ! freqsEnabled" (click)="onInsert(n)">Insert</button>
                    </div>
                    <div class="psm-input-group-4">
                      <button class="form-control" [disabled]="values.freqs.length <= 2 || ! freqsEnabled" (click)="onDelete(n)">Delete</button>
                    </div>
                  </ng-container>
                </div>
                <div [hidden]="! freqsEnabled || validFreqs" class="alert alert-danger">
                  Discrete frequency values are required, and must consist of numbers
                </div>
              </div>
              <div class="form-group">
                <div class="psm-input-group">
                  <label for="audio">Collect audio</label>
                  <select psmInput class="form-control" [(ngModel)]="values.audio.enabled" name="audio">
                    <option [ngValue]="true">On</option>
                    <option [ngValue]="false">Off</option>
                  </select>
                </div>
                <div class="psm-input-group">
                  <label for="duration">Sample duration (s)</label>
                  <input psmInput type="number" pattern="[0-9]+" required class="form-control" [(ngModel)]="values.audio.duration" name="duration" #duration="ngModel">
                </div>
              </div>
              <div [hidden]="duration.valid || duration.pristine" class="alert alert-danger">
                Sample duration is a required integer parameter
              </div>
              <div class="form-group">
                <div class="psm-input-group">
                  <label for="threshold">Level threshold (dB)</label>
                  <input psmInput type="number" pattern="-?[0-9]+" required class="form-control" [(ngModel)]="values.audio.threshold" name="threshold" #threshold="ngModel">
                </div>
                <div class="psm-input-group">
                  <label for="period">Sample period (s)</label>
                  <input psmInput type="number" pattern="[0-9]+" required class="form-control" [(ngModel)]="values.audio.period" name="period" #period="ngModel">
                </div>
              </div>
              <div [hidden]="threshold.valid || threshold.pristine" class="alert alert-danger">
                Level threshold is a required integer parameter
              </div>
              <div [hidden]="period.valid || period.pristine" class="alert alert-danger">
                Sample period is a required integer parameter
              </div>
             </psm-widget>`
})
export class ScanComponent extends WidgetBase { //FIXME Scan is now a bad name
  units: any[] = [];

  constructor (private stateService: StateService) { super() }

  ngOnInit() {
    //FIXME copy code
    let hz = this.stateService.constants.hz_labels;
    for (let value in hz) {
      this.units.push({ value: value, label: hz[value] });
    }
  }

  //FIXME copy code for range stuff
  numeric(v): boolean {
    return $.isNumeric(v);
  }

  validNumber(input): boolean {
    return (input.valid && $.isNumeric(input.model)) || input.pristine;
  }

  get rangeEnabled(): boolean {
    return this.values.freqs[0].enabled;
  }

  set rangeEnabled(value: boolean) {
    this.values.freqs[0].enabled = value;
  }

  get validRange(): boolean {
    return +(this.values.freqs[0].range[0]) + +(this.values.freqs[0].range[2]) <= +(this.values.freqs[0].range[1]);
  }

  get freqsEnabled(): boolean {
    return this.values.freqs[1].enabled;
  }

  set freqsEnabled(value: boolean) {
    for (let freq of this.values.freqs) {
      if (freq.range) continue;
      freq.enabled = value;
    }
  }

  get validFreqs(): boolean {
    for (let freq of this.values.freqs) {
      if (freq.range) continue;
      if (! this.numeric(freq.freq)) return false;
    }
    return true;
  }

  // return whether the inputs represent a valid scan
  get validScan(): boolean {
    return (this.rangeEnabled && this.validRange) || (this.freqsEnabled && this.validFreqs);
  }

  // insert a discrete frequency at position n
  onInsert(n: number) {
    let fs = this.values.freqs;
    fs.splice(n + 2, 0, { enabled: true, freq: "", exp: fs[n + 1].exp });
  }

  // delete a discrete frequency at position n
  onDelete(n: number) {
    this.values.freqs.splice(n + 1, 1);
  }
}
