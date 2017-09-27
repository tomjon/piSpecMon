import { Observable } from 'rxjs/Observable';
import { DataService } from './data.service';
import { StateService } from './state.service';
import { WidgetComponent } from './widget.component';
import { User } from './user';
import { equals } from './object-equals';

declare var $;

//FIXME interactions between instances of this class and WidgetComponent suggest they should be the same...
//FIXME (i.e. has-a was in retrospect the wrong object model, should have been is-a)
export abstract class WidgetBase {
  private _widgetComponent: WidgetComponent;
  public _key: string; //FIXME make back into private and move process/status stuff into here (maybe)
  public _reqs_caps: string; //FIXME horrible - how else to indicate the dependency? (on what exactly)

  private _values: any; // input values

  constructor(protected dataService: DataService, protected stateService: StateService) {}

  //FIXME this is really bad
  protected setViewChildren(key: string, widgetComponent: WidgetComponent, reqs_caps?: string) {
    if (reqs_caps != undefined) this._reqs_caps = reqs_caps;
    this._key = key;
    this._widgetComponent = widgetComponent;
    widgetComponent.widgetBase = this; //FIXME yuck!
    this._values = $.extend(true, {}, this.stateService.values[key]);
    this.stateService.registerWidget(this); //FIXME yuck - see elsewhere
  }

  // values either refers to the current selected config values, or the user entered values
  get values(): any {
    if (this._key != undefined && this.stateService.currentConfig != undefined) {
      return this.stateService.currentConfig.values[this._key];
    }
    return this._values;
  }

  get caps(): any {
    return this.stateService.caps[this._reqs_caps] || {};
  }

  get capsKeys(): string[] {
    return Object.keys(this.caps);
  }

  get isPristine(): boolean {
    return equals(this.values, this.stateService.values[this._key]);
  }

  get canReset(): boolean {
    return this.stateService.currentConfig == undefined && ! this.isPristine;
  }

  get canSubmit(): boolean {
    return ! this.isPristine;
  }

  get disabled(): boolean {
    return this._widgetComponent.loading || this.stateService.currentConfig != undefined || ! this.stateService.user.roleIn(['admin', 'freq']);
  }

  get current(): boolean {
    return this.stateService.currentConfig != undefined;
  }

  get user(): User {
    return this.stateService.user;
  }

  get static(): boolean {
    return this._key == undefined;
  }

  reset(): void {
    this._values = Object.assign({}, this.stateService.values[this._key]);
  }

  setSettings(): Observable<void> {
    return this.dataService.setSettings(this._key, this.values);
  }

  assignValues(): void {
    Object.assign(this.stateService.values[this._key], this.values);
    Object.assign(this._values, this.values);
  }
}