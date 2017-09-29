import { ViewChild } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { StateService } from './state.service';
import { WidgetComponent } from './widget.component';
import { User } from './user';

export abstract class WidgetBase {
  @ViewChild(WidgetComponent) widgetComponent;

  //FIXME simplify around the place by using state service through widget component where necessary
  constructor(protected stateService: StateService) {}

  //FIXME this is really bad (and no longer uses key or WidgetComponent)
  protected setViewChildren(key: string, widgetComponent: WidgetComponent, reqs_caps?: string) {}

  get values(): any {
    return this.widgetComponent.values;
  }

  get caps(): any {
    return this.widgetComponent.caps;
  }

  get capsKeys(): string[] {
    return Object.keys(this.caps);
  }

  get user(): User {
    return this.stateService.user;
  }
}
