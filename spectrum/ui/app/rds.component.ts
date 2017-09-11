import { Component, Input, ViewChild } from '@angular/core';
import { StateService } from './state.service';
import { DataService } from './data.service';
import { WidgetBase } from './widget.base';
import { WidgetComponent } from './widget.component';
import { Config } from './config';
import { DatePipe } from './date.pipe';
import { HZ_LABELS } from './constants';
import { InputDirective } from './input.directive';

@Component({
  selector: 'psm-rds',
  templateUrl: 'templates/rds.html',
  directives: [ WidgetComponent, InputDirective ],
  pipes: [ DatePipe ]
})
export class RdsComponent extends WidgetBase {
  units: any[] = [ ];

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(dataService: DataService, stateService: StateService) { super(dataService, stateService) }

  ngOnInit() {
    for (let value in HZ_LABELS) {
      this.units.push({ value: value, label: HZ_LABELS[value] });
    }
    this.setViewChildren('rds', this.widgetComponent);
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
}
