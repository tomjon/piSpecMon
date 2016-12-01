import { Component, Input } from '@angular/core';

@Component({
  selector: 'overseer-event',
  template: `{{event.type}}`
})
export class EventComponent {
  /**
   * A cartouche representing the event.
   **/
  @Input('event') event;

  constructor() {}

  ngOnInit() {
  }
}
