import { Component } from '@angular/core';
import { StateService } from './state.service';
import { FrequencyComponent } from './frequency.component';
import { LevelComponent } from './level.component';
import { WaterfallComponent } from './waterfall.component';
import { SampleTableComponent } from './sample-table.component';
import { RdsTableComponent } from './rds-table.component';
import { TemperatureComponent } from './temperature.component';

@Component({
  selector: 'psm-charts',
  templateUrl: 'templates/charts.html',
  directives: [ FrequencyComponent, LevelComponent, WaterfallComponent, SampleTableComponent, RdsTableComponent, TemperatureComponent ]
})
export class ChartsComponent {
  constructor(private stateService: StateService) { }

  //FIXME horrible..? move to state service?
  get loading(): number {
    return this.stateService.currentConfig ? this.stateService.currentConfig.data.loading : undefined;
  }
}
