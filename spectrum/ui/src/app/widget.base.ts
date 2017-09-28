import { ViewChild } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { StateService } from './state.service';
import { WidgetComponent } from './widget.component';
import { User } from './user';

declare var $;

export abstract class WidgetBase {
  @ViewChild(WidgetComponent) widgetComponent;

  //FIXME simplify around the place by using state service through widget component where necessary
  constructor(protected stateService: StateService) {}

  //FIXME this is really bad (and no longer uses key or WidgetComponent)
  protected setViewChildren(key: string, widgetComponent: WidgetComponent, reqs_caps?: string) {
    this.stateService.registerWidget(this); //FIXME yuck - see elsewhere
  }

  get values(): any {
    return this.widgetComponent.values;
  }

  get caps(): any {
    if (this.widgetComponent.key == undefined) return undefined;
    return this.stateService.caps[this.widgetComponent.key] || {};
  }

  get capsKeys(): string[] {
    return Object.keys(this.caps);
  }

  get disabled(): boolean {
    return this.widgetComponent.loading || this.stateService.currentConfig != undefined || ! this.stateService.user.roleIn(['admin', 'freq']);
  }

  get current(): boolean {
    return this.stateService.currentConfig != undefined;
  }

  get user(): User {
    return this.stateService.user;
  }
}
