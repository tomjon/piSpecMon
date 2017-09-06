import { Component, Input, Output, EventEmitter, ContentChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Observable } from 'rxjs/Observable';
import { StateService } from './state.service';
import { UiSettingsService } from './ui-settings.service';
import { Config } from './config';
import { WidgetBase } from './widget.base';

declare var $;

//FIXME references widgetBase will hopefully disappear when/if widget component merged with base
@Component({
  selector: 'psm-widget',
  templateUrl: 'templates/widget.html'
})
export class WidgetComponent {
  _loading: number = 0;
  show: boolean = false;

  widgetBase: WidgetBase; //FIXME set by widget base

  //FIXME can perhaps do away with form entirely, and do your own validation (i.e. call each input's validation method)
  @ContentChild('form') form: NgForm; //FIXME should the form, in fact, be part of the widget.html? If you need component access to the form, it should be via the widget base (easier if inhertance)

  @Input() title: string;
  @Output('show') showEmitter = new EventEmitter<boolean>();

  constructor(private stateService: StateService, private uiSettings: UiSettingsService) {}

  ngOnInit() {
    if (this.title) {
      this.uiSettings.get(this.title)
                     .subscribe(show => {
                       this.show = show;
                       this.showEmitter.emit(show);
                     });
    } else {
      this.show = true;
      this.showEmitter.emit(true);
    }
  }

  toggle() {
    this.show = ! this.show;
    this.showEmitter.emit(this.show);
    this.uiSettings.set(this.title, this.show).subscribe();
  }

  get loading(): boolean {
    return this._loading > 0;
  }

  get current(): boolean {
    return this.widgetBase && ! this.widgetBase.static && this.stateService.currentConfig != undefined;
  }

  get showIcons(): boolean {
    return this.title && this.form && this.stateService.user.roleIn(['admin', 'freq']); //FIXME clearly should be based on what privs the widget requires...
  }

  get canReset(): boolean {
    return ! this.loading && this.widgetBase.canReset;
  }

  onReset(): void {
    this.widgetBase.reset();
    if (this.form) this.pristine(this.form);
  }

  get canSubmit(): boolean {
    return ! this.loading && this.widgetBase.canSubmit;
  }

  onSubmit(): void {
    this.busy(this.widgetBase.setSettings())
        .subscribe(() => this.widgetBase.assignValues());
    if (this.form) this.pristine(this.form);
  }

  //FIXME will this mechanism interact badly with stateService callback that sets everything disabled? Maybe only allow this on 'static' widgets
  busy(obs: Observable<any>): Observable<any> {
    ++this._loading;
    return Observable.create(observer => {
      obs.subscribe(observer);
      return () => --this._loading;
    });
  }

  pristine(form: any, value?: boolean): void {
    if (value == undefined) value = true; // default argument value not working, weirdly
    if (! form) return;
    form['_touched'] = ! value;
    form['_pristine'] = value;
    form.form['_touched'] = ! value;
    form.form['_pristine'] = value;
    for (let k in form.form.controls) {
      form.form.controls[k]['_touched'] = ! value;
      form.form.controls[k]['_pristine'] = value;
    }
  }
}
