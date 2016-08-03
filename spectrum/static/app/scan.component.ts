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
  @Input('config') input: any;

  units: any[] = [ ];
  scan: any;

  @ViewChild(WidgetComponent) widgetComponent;
  @ViewChild('form') form;

  constructor(private dataService: DataService) { }

  /*ngOnChanges() {
    if (this.input == undefined) this.input = DEFAULTS;
    this.scan = $.extend(true, { }, this.input);
  }*/

  ngOnInit() {
    for (let value in HZ_LABELS) {
      this.units.push({ value: value, label: HZ_LABELS[value] });
    }
    this.scan = $.extend(true, { }, DEFAULTS);
  }

  onRescan() {
    this.scan = $.extend(true, { }, this.input);
    this.widgetComponent.pristine(this.form);
  }

  onStart() {
  }

  onStop() {
  }

  get loading() {
    return this.widgetComponent.loading;
  }

  validNumber(input): boolean {
    return (input.valid && $.isNumeric(input.model)) || input.pristine;
  }

  validRange(): boolean {
    return +(this.scan.freqs.range[0]) + +(this.scan.freqs.range[2]) < +(this.scan.freqs.range[1]);
  }
}
