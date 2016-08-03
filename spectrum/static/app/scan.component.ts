import { Component, Input, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';
import { Config } from './config';
import { DEFAULTS, HZ_LABELS } from './constants';

declare var $;

@Component({
  selector: 'psm-scan',
  templateUrl: 'templates/scan.html',
  directives: [ WidgetComponent ]
})
export class ScanComponent {
  @Input() modes: any[] = [ ];

  input: any;

  units: any[] = [ ];
  config: any;
  status: any;

  @ViewChild(WidgetComponent) widgetComponent;
  @ViewChild('form') form;

  constructor(private dataService: DataService) { }

  @Input('status') set _status(status: string) {
    this.status = status;
  }

  @Input('config') set _config(config: Config) {
    this.input = config;
    if (this.input == undefined) {
      this.widgetComponent.pristine(this.form, false);
      return;
    }
    this.config = $.extend(true, { }, this.input);
    this.widgetComponent.pristine(this.form);
  }

  ngOnInit() {
    for (let value in HZ_LABELS) {
      this.units.push({ value: value, label: HZ_LABELS[value] });
    }
    this.config = $.extend(true, { }, DEFAULTS);
    this.widgetComponent.pristine(this.form);
  }

  onReset() {
    if (this.input == undefined) this.input = DEFAULTS;
    this._config = this.input;
  }

  onStart() {
    this.widgetComponent.busy(this.dataService.startMonitor(this.config))
                        .subscribe(() => { });
  }

  onStop() {
    this.widgetComponent.busy(this.dataService.stopMonitor())
                        .subscribe(() => { });
  }

  get loading() {
    return this.widgetComponent.loading;
  }

  validNumber(input): boolean {
    return (input.valid && $.isNumeric(input.model)) || input.pristine;
  }

  validRange(): boolean {
    return +(this.config.freqs.range[0]) + +(this.config.freqs.range[2]) <= +(this.config.freqs.range[1]);
  }
}
