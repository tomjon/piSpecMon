import { Component, Input } from '@angular/core';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'psm-widget',
  templateUrl: 'templates/widget.html'
})
export class WidgetComponent {
  _loading: number = 0;
  show: boolean = true;

  @Input() title: string;

  toggle() {
    this.show = ! this.show;
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
}
