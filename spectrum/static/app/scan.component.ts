import { Component, Input, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';
import { Config } from './config';
import { User } from './user';
import { DatePipe } from './date.pipe';
import { FreqPipe } from './freq.pipe';
import { HZ_LABELS } from './constants';

declare var $;

/**
 * Scan component has two modes:
 * 1. when there is no running scan, then either: show the current sweep selection
 *    in the inputs, or defaults if no selection
 *      (Reset returns the inputs back to either the selection, or the defaults)
 * 2. when there is a running scan, inputs show the running config values and are
 *    disabled, and the status is displayed
 * When the user is only a data viewer, don't show the inputs at all. If there
 * is also no running scan, show a brief message to this effect.
 */
@Component({
  selector: 'psm-scan',
  templateUrl: 'templates/scan.html',
  directives: [ WidgetComponent ],
  pipes: [ DatePipe, FreqPipe ]
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
  @Input() user: User;

  @Input('status') set _status(status: any) {
    if (status == undefined) return;
    if (this.defaults != undefined) this.standby = false;
    this.worker = status.worker;
    this.monkey = status.monkey;
  }

  @Input('config') set _config(config: any) {
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
    if (this.user.roleIn(['admin', 'freq'])) {
      this.widgetComponent.busy(this.dataService.getScan())
                          .subscribe(defaults => {
                            this.defaults = defaults;
                            this.config = $.extend(true, { }, this.defaults);
                            this.widgetComponent.pristine(this.form);
                          });
    } else {
      this.standby = false;
    }
  }

  onReset() {
    if (this.input == undefined) this._config = this.defaults;
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
                        .subscribe(() => { this.input = this.defaults });
  }

  get loading() {
    return this.widgetComponent.loading || this.standby;
  }

  numeric(v): boolean {
    return $.isNumeric(v);
  }

  validNumber(input): boolean {
    return (input.valid && $.isNumeric(input.model)) || input.pristine;
  }

  get validRange(): boolean {
    return +(this.config.freqs.range[0]) + +(this.config.freqs.range[2]) <= +(this.config.freqs.range[1]);
  }

  get validFreqs(): boolean {
    for (let freq of this.config.freqs.freqs) {
      if (! this.numeric(freq.f)) return false;
    }
    return true;
  }

  // return whether the inputs represent a valid scan
  get validScan(): boolean {
    return this.form.form.valid && (this.validRange || this.validFreqs);
  }

  // return whether a scan is running
  get running(): boolean {
    return this.worker.timestamp || this.monkey.timestamp;
  }

  // insert a discrete frequency at position n
  onInsert(n: number) {
    let fs = this.config.freqs.freqs;
    fs.splice(n + 1, 0, { f: "", exp: fs[n].exp });
  }

  // delete a discrete frequency at position n
  onDelete(n: number) {
    this.config.freqs.freqs.splice(n, 1);
  }
}
