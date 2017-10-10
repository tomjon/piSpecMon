import { Component, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';

@Component({
  selector: 'psm-pico',
  template: `<psm-widget title="Pico Status">
               <form role="form">
                 <pre *ngIf="text" class="form-group">{{text}}</pre>
                 <pre *ngIf="error" class="form-group error">{{error}}</pre>
                 <div class="form-group">
                   <button class="btn btn-default" (click)="onClick()">Refresh</button>
                 </div>
               </form>
             </psm-widget>`
})
export class PicoComponent {
  text: string;
  error: string;

  @ViewChild(WidgetComponent) widgetComponent;

  constructor(private dataService: DataService) {}

  onClick() {
    this.widgetComponent.busy(this.dataService.getPicoStatus())
                        .subscribe(status => {
                          this.text = status.text;
                          this.error = status.error;
                        });
  }
}
