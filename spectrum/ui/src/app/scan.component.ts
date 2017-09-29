import { Component, ViewChild } from '@angular/core';
import { WidgetBase } from './widget.base';
import { StateService } from './state.service';
import { FreqRangeComponent } from './freq-range.component';

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
              <psm-freq-range [range]="values.freqs[0]" [disabled]="! rangeEnabled">
                <input psmInput type="checkbox" (ngModelChange)="freqsEnabled = rangeEnabled" [(ngModel)]="rangeEnabled" class="toggle" name="range">
              </psm-freq-range>
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
                        <option *ngFor="let u of stateService.units" value="{{u.value}}">{{u.label}}</option>
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
  @ViewChild(FreqRangeComponent) range: FreqRangeComponent;

  constructor (private stateService: StateService) { super() }

  //FIXME this copy-code from freq range component will get removed if/when discrete freqs get used everywhere and make it into the range component (which will have to be renamed)
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
    return (this.rangeEnabled && this.range.valid) || (this.freqsEnabled && this.validFreqs);
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
