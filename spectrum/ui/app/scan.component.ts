import { Component, Input, ViewChild } from '@angular/core';
import { StateService } from './state.service';
import { DataService } from './data.service';
import { WidgetBase } from './widget.base';
import { WidgetComponent } from './widget.component';
import { Config } from './config';
import { User } from './user';
import { DatePipe } from './date.pipe';
import { FreqPipe } from './freq.pipe';

declare var $;

@Component({
  selector: 'psm-scan',
  templateUrl: 'templates/scan.html',
  directives: [ WidgetComponent ],
  pipes: [ DatePipe, FreqPipe ],
  styles: ['.scan-cap label { text-transform: capitalize }']
})
export class ScanComponent extends WidgetBase {
  units: any[] = [];

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(dataService: DataService, stateService: StateService) { super(dataService, stateService) }

  ngOnInit() {
    let hz = this.dataService.constants.hz_labels;
    for (let value in hz) {
      this.units.push({ value: value, label: hz[value] });
    }
    this.setViewChildren('scan', this.widgetComponent);
  }

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
