import { Component, Input, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';
import { Config } from './config';
import { DatePipe } from './date.pipe';
import { HZ_LABELS } from './constants';

declare var $;

@Component({
  selector: 'psm-scan',
  templateUrl: 'templates/scan.html',
  directives: [ WidgetComponent ],
  pipes: [ DatePipe ]
})
export class ScanComponent {
  defaults: any;
  input: any;
  config: any;

  worker: any = { };
  monkey: any = { };

  units: any[] = [ ];

  // true when waiting for (real) status after startup or start/stop buttons pressed
  standby: boolean = true;

  allowRange: boolean = true;
  allowFreqs: boolean = false;

  @ViewChild(WidgetComponent) widgetComponent;
  @ViewChild('form') form;

  @Input() modes: any[] = [ ];

  @Input('status') set _status(status: any) {
    if (! this.defaults || status == undefined) return;
    this.standby = false;
    this.worker = status.worker;
    this.monkey = status.monkey;
  }

  @Input('config') set _config(config: Config) {
    if (! this.defaults || this.worker.config_id) return;
    this.input = config;
    if (this.input == undefined) {
      this.widgetComponent.pristine(this.form, false);
      return;
    }
    this.config = $.extend(true, {}, this.defaults, this.input);
    this.allowRange = this.input.freqs.range != undefined;
    this.allowFreqs = this.input.freqs.freqs != undefined && this.input.freqs.freqs[0].f;
    this.widgetComponent.pristine(this.form);
  }

  constructor(private dataService: DataService) { }

  ngOnInit() {
    for (let value in HZ_LABELS) {
      this.units.push({ value: value, label: HZ_LABELS[value] });
    }
    this.widgetComponent.busy(this.dataService.getScan())
                        .subscribe(defaults => {
                          this.defaults = defaults;
                          this.config = $.extend(true, { }, this.defaults);
                          this.widgetComponent.pristine(this.form);
                        });
  }

  onReset() {
    if (this.input == undefined) this.input = this.defaults;
    this._config = this.input;
  }

  onStart() {
    this.standby = true;
    let config = $.extend(true, { }, this.config);
    if (! this.allowRange) {
      delete config.freqs.range;
    }
    if (! this.allowFreqs) {
      delete config.freqs.freqs;
    }
    this.widgetComponent.busy(this.dataService.startMonitor(config))
                        .subscribe();
  }

  onStop() {
    this.standby = true;
    this.widgetComponent.busy(this.dataService.stopMonitor())
                        .subscribe();
  }

  get loading() {
    return this.widgetComponent.loading;
  }

  numeric(v): boolean {
    return $.isNumeric(v);
  }

  validNumber(input): boolean {
    return (input.valid && $.isNumeric(input.model)) || input.pristine;
  }

  validRange(): boolean {
    return +(this.config.freqs.range[0]) + +(this.config.freqs.range[2]) <= +(this.config.freqs.range[1]);
  }

  validFreqs(): boolean {
    for (let freq of this.config.freqs.freqs) {
      if (! this.numeric(freq.f)) return false;
    }
    return true;
  }

  validScan(): boolean {
    return this.form.form.valid && ((this.validRange && this.validRange()) || (this.validFreqs && this.validFreqs()));
  }

  freq(freq_n: number): string {
    if (this.allowRange) {
      let f = +this.config.freqs.range[0] + this.config.freqs.range[2] * freq_n;
      return `${f.toFixed(-Math.log10(this.config.freqs.range[2]))}${HZ_LABELS[this.config.freqs.exp]}`;
    } else {
      let f = this.config.freqs.freqs[freq_n].f;
      return `${f}${HZ_LABELS[this.config.freqs.freqs[freq_n].exp]}`;
    }
  }

  get running(): boolean {
    return this.worker.timestamp || this.monkey.timestamp;
  }

  onInsert(n: number) {
    let fs = this.config.freqs.freqs;
    fs.splice(n + 1, 0, { f: "", exp: fs[n].exp });
  }

  onDelete(n: number) {
    this.config.freqs.freqs.splice(n, 1);
  }
}
