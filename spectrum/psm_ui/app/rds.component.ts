import { Component, Input, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';

@Component({
  selector: 'psm-rds',
  templateUrl: 'templates/rds.html',
  directives: [ WidgetComponent ]
})
export class RdsComponent {
  rds: any = { };

  @ViewChild(WidgetComponent) widgetComponent;
  @ViewChild('form') form;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.onReset();
  }

  onReset() {
    this.widgetComponent.busy(this.dataService.getRds())
                        .subscribe(rds => this.rds = rds);
    if (this.form) this.widgetComponent.pristine(this.form);
  }

  onSubmit() {
    this.widgetComponent.busy(this.dataService.setRds(this.rds))
                        .subscribe();
    this.widgetComponent.pristine(this.form);
  }

  get loading() {
    return this.widgetComponent.loading;
  }
}
