import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { UiSettingsService } from './ui-settings.service';

@Component({
  selector: 'psm-widget',
  templateUrl: 'templates/widget.html'
})
export class WidgetComponent {
  _loading: number = 0;
  show: boolean = false;

  @Input() title: string;
  @Output('show') showEmitter = new EventEmitter<boolean>();

  constructor (private uiSettings: UiSettingsService) {}

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

  busy(obs: Observable<any>): Observable<any> {
    ++this._loading;
    return Observable.create(observer => {
      obs.subscribe(observer);
      return () => --this._loading;
    });
  }

  pristine(form: any, value?: boolean): void {
    if (value == undefined) value = true; // default argument value not working, weirdly
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
