import { Component } from '@angular/core';
import { StateService } from './state.service';

@Component({
  selector: 'psm-charts',
  template: `<p *ngIf="loading != undefined">Loading... ({{loading}}0%)</p>
              <ng-container *ngIf="enabled('hamlib')">
                <psm-worker-error worker="hamlib"></psm-worker-error>
                <psm-frequency worker="hamlib"></psm-frequency>
                <psm-level worker="hamlib"></psm-level>
                <psm-temperature worker="hamlib"></psm-temperature>
                <psm-waterfall worker="hamlib"></psm-waterfall>
                <psm-sample-table worker="hamlib"></psm-sample-table>
              </ng-container>
              <ng-container *ngIf="enabled('rds')">
                <psm-worker-error worker="rds"></psm-worker-error>
                <psm-frequency worker="rds"></psm-frequency>
                <psm-level worker="rds"></psm-level>
                <psm-waterfall worker="rds"></psm-waterfall>
                <psm-sample-table worker="rds"></psm-sample-table>
                <psm-rds-table worker="rds"></psm-rds-table>
              </ng-container>
              <ng-container *ngIf="enabled('sdr')">
                <psm-worker-error worker="sdr"></psm-worker-error>
                <psm-frequency worker="sdr"></psm-frequency>
                <psm-level worker="sdr"></psm-level>
                <psm-waterfall worker="sdr"></psm-waterfall>
              </ng-container>
              <ng-container *ngIf="enabled('ams')">
                <psm-worker-error worker="ams"></psm-worker-error>
                <psm-frequency worker="ams"></psm-frequency>
                <psm-level worker="ams"></psm-level>
                <psm-waterfall worker="ams"></psm-waterfall>
              </ng-container>`
})
export class ChartsComponent {
  constructor(private stateService: StateService) { }

  //FIXME horrible..? move to state service?
  get loading(): number {
    return this.stateService.currentConfig != undefined &&
           this.stateService.currentConfig.data != undefined ? this.stateService.currentConfig.data.loading : 0;
  }

  enabled(worker: string): boolean {
    return this.stateService.currentConfig != undefined ? this.stateService.currentConfig.values.workers.includes(worker) : false;
  }
}
