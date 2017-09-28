import { ViewChild } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { StateService } from './state.service';
import { WidgetComponent } from './widget.component';
import { User } from './user';

declare var $;

export abstract class WidgetBase {
  public _reqs_caps: string; //FIXME horrible - how else to indicate the dependency? (on what exactly)
  //FIXME I now think you can use the same as the key - and use the key twice on different widgets just fine

  @ViewChild(WidgetComponent) widgetComponent;

  //FIXME simplify around the place by using state service through widget component where necessary
  constructor(protected stateService: StateService) {}

  //FIXME this is really bad (and no longer uses key or WidgetComponent)
  protected setViewChildren(key: string, widgetComponent: WidgetComponent, reqs_caps?: string) {
    if (reqs_caps != undefined) this._reqs_caps = reqs_caps;
    widgetComponent.widgetBase = this; //FIXME yuck!
    this.stateService.registerWidget(this); //FIXME yuck - see elsewhere
  }

  get values(): any {
    return this.widgetComponent.values;
  }

  get caps(): any {
    return this.stateService.caps[this._reqs_caps] || {};
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
