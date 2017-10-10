import { Component, Input } from '@angular/core';
import { StateService } from './state.service';
import { Chart } from './chart';

@Component({
  selector: 'psm-worker-error',
  template: `
    <psm-widget [hidden]="isHidden" title="{{label}} - Error" class="chart" (show)="onShow($event)">
      <table>
        <tr *ngFor="let error of data.errors">
          <td class="time">{{error[0] | date}}</td>
          <td class="message">{{error[1]}}</td>
        </tr>
      </table>
    </psm-widget>`,
  styles: [
    'table { clear: both; margin-bottom: 10px }',
    '.time { padding-right: 20px }',
    '.message { color: red }'
  ]
})
export class WorkerErrorComponent extends Chart {
  constructor(stateService: StateService) { super(null, stateService, null, 'error') }

  plot() {}

  get isHidden(): boolean {
    return this.data == undefined || this.data.errors.length == 0;
  }
}
