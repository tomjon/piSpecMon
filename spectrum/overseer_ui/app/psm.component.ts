import { Component, Input } from '@angular/core';

@Component({
  selector: 'overseer-psm',
  template: `***<h2>{{psm.name}}</h2><span>{{psm.timestamp | date:'medium'}}</span>`
})
export class PsmComponent {
  /**
   * A cartouche representing the PSM. The colour changes based on the recency
   * of the timestamp.
   **/
  @Input('psm') psm;

  constructor() {}

  ngOnInit() {
  }
}
