import { Component, Input, ViewChild } from '@angular/core';
import { StateService } from './state.service';
import { DataService } from './data.service';
import { WidgetBase } from './widget.base';
import { WidgetComponent } from './widget.component';
import { Config } from './config';
import { DatePipe } from './date.pipe';
import { FreqPipe } from './freq.pipe';
import { HZ_LABELS } from './constants';
import { InputDirective } from './input.directive';

declare var $;

@Component({
  selector: 'psm-rds',
  templateUrl: 'templates/rds.html',
  directives: [ WidgetComponent, InputDirective ],
  pipes: [ DatePipe, FreqPipe ]
})
export class RdsComponent extends WidgetBase {
  monkey: any = { };

  units: any[] = [ ];

  // true when waiting for (real) status after startup or start/stop buttons pressed
  standby: boolean = true;

  @ViewChild(WidgetComponent) widgetComponent;

  @Input('status') set _status(status: any) {
    if (status == undefined) return;
    if (this.widgetComponent.original != undefined) this.standby = false;
    this.monkey = status.monkey;
  }

  constructor(dataService: DataService, stateService: StateService) { super(dataService, stateService) }

  ngOnInit() {
    for (let value in HZ_LABELS) {
      this.units.push({ value: value, label: HZ_LABELS[value] });
    }
    this.setViewChildren('rds', this.widgetComponent);
    this.standby = false; //FIXME should be set when settings loaded
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

  onStart() {
    this.widgetComponent.onSubmit();
    this.standby = true;
    this.widgetComponent.busy(this.dataService.start(this.values))
                        .subscribe();
  }

  onStop() {
    this.standby = true;
    this.widgetComponent.busy(this.dataService.stop())
                        .subscribe();
  }

  //FIXME override
  get loading() {
    return this.widgetComponent.loading || this.standby;
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

  // return whether a scan is running
  get running(): boolean {
    return this.monkey.timestamp;
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
