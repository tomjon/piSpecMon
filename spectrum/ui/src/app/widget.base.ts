import { ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';

export abstract class WidgetBase {
  @ViewChild(WidgetComponent) widgetComponent;

  get values(): any {
    return this.widgetComponent.values;
  }

  get caps(): any {
    return this.widgetComponent.caps;
  }

  get capsKeys(): string[] {
    return Object.keys(this.caps);
  }
}
