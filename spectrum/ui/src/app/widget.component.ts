import { Component, Input, Output, EventEmitter, ContentChild } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { NgForm } from '@angular/forms';
import { Observable } from 'rxjs/Observable';
import { DataService } from './data.service';
import { StateService } from './state.service';
import { UiSettingsService } from './ui-settings.service';
import { Config } from './config';
import { equals } from './object-equals';

declare var $;

@Component({
  selector: 'psm-widget',
  template:
    `<div *ngIf="enabled" class="container" [ngClass]="{'notitle': title == undefined}">
       <h1 *ngIf="title" (click)="toggle()">
         {{title}}
         <span *ngIf="show" class="toggle glyphicon glyphicon-collapse-down"></span>
         <span *ngIf="! show" class="toggle glyphicon glyphicon-collapse-up"></span>
         <span *ngIf="loading" class="busy glyphicon glyphicon-transfer"></span>
       </h1>
       <div *ngIf="showIcons && show" class="icons">
         <span *ngIf="loading" class="busy glyphicon glyphicon-transfer"></span>
         <span (click)="onReset()" class="glyphicon glyphicon-arrow-left" [ngClass]="{disabled: ! canReset}"></span>
         <span (click)="onSubmit()" class="glyphicon glyphicon-save" [ngClass]="{disabled: ! canSubmit}"></span>
       </div>
       <form *ngIf="show" role="form" #form="ngForm">
         <ng-content></ng-content>
       </form>
     </div>`,
  styles: [
    `.container { width: auto; background: lightgoldenrodyellow; margin: 5px; position: relative }`,
    `h1 { font-size: 20px; margin-top: 15px; margin-bottom: 15px; cursor: pointer }`,
    `.toggle { float: left; margin-right: 4px }`,
    `.icons { position: absolute; right: 16px; top: 12px }`,
    `.notitle { padding-top: 10px; padding-bottom: 10px; background: initial }`
  ]
})
export class WidgetComponent {
  _values: any; // user input values

  _loading: number = 0;
  show: boolean = false;

  //FIXME can perhaps do away with form entirely, and do your own validation (i.e. call each input's validation method)
  @ContentChild('form') form: NgForm; //FIXME should the form, in fact, be part of the widget.html? If you need component access to the form, it should be via the widget base (easier if inhertance)

  @Input() key: string;
  @Input() title: string;
  @Output('show') showEmitter = new EventEmitter<boolean>();

  loadingChange: Subject<boolean> = new Subject<boolean>();

  constructor(protected dataService: DataService, private stateService: StateService, private uiSettings: UiSettingsService) {
    this.stateService.registerWidget(this);
  }

  ngOnInit() {
    this._values = $.extend(true, {}, this.stateService.values[this.key]);
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

  get caps(): any {
    if (this.key == undefined) return undefined;
    return this.stateService.caps[this.key] || {};
  }

  // values either refers to the current selected config values, or the user entered values
  get values(): any {
    if (this.key != undefined && this.stateService.currentConfig != undefined) {
      return this.stateService.currentConfig.values[this.key];
    }
    return this._values;
  }

  get isPristine(): boolean {
    return this.key == undefined || equals(this.values, this.stateService.values[this.key]);
  }

  get canReset(): boolean {
    return ! this.loading && this.stateService.currentConfig == undefined && ! this.isPristine;
  }

  get canSubmit(): boolean {
    return ! this.loading && ! this.isPristine;
  }

  get enabled(): boolean {
    return this.key == undefined || this.stateService.workerEnabled(this.key);
  }

  toggle() {
    this.show = ! this.show;
    this.showEmitter.emit(this.show);
    this.uiSettings.set(this.title, this.show).subscribe();
  }

  get loading(): boolean {
    return this._loading > 0;
  }

  get showIcons(): boolean {
    return this.key && this.title && this.stateService.user.roleIn(['admin', 'freq']); //FIXME clearly should be based on what privs the widget requires...
  }

  onReset(): void {
    if (! this.canReset) return;
    this._values = Object.assign({}, this.stateService.values[this.key]);
  }

  onSubmit(): void {
    if (! this.canSubmit) return;
    this.busy(this.dataService.setSettings(this.key, this.values))
        .subscribe(() => {
          Object.assign(this.stateService.values[this.key], this.values);
          Object.assign(this._values, this.values);
        });
  }

  busy(obs: Observable<any>): Observable<any> {
    ++this._loading;
    this.loadingChange.next(this.loading);
    return Observable.create(observer => {
      obs.subscribe(observer);
      return () => {
        --this._loading;
        this.loadingChange.next(this.loading);
      };
    });
  }
}
