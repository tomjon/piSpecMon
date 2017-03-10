import { Component, Input, Output, ViewChild, EventEmitter } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';

@Component({
  selector: 'psm-ident',
  templateUrl: 'templates/ident.html',
  directives: [ WidgetComponent ]
})
export class IdentComponent {
  ident: any = {};

  @Input() user;
  @Output('ident') idEmitter: EventEmitter<any> = new EventEmitter();

  @ViewChild(WidgetComponent) widgetComponent;
  @ViewChild('form') form;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.onReset();
  }

  private emit(ident?: any) {
    if (ident) this.ident = ident;
    this.idEmitter.emit({ name: this.ident.name, description: this.ident.description });
  }

  onReset() {
    this.widgetComponent.busy(this.dataService.getIdent())
                        .subscribe(id => this.emit(id));
    if (this.form) this.widgetComponent.pristine(this.form);
  }

  onSubmit() {
    this.widgetComponent.busy(this.dataService.setIdent(this.ident))
                        .subscribe(() => this.emit());
    this.widgetComponent.pristine(this.form);
  }

  get loading() {
    return this.widgetComponent.loading;
  }
}
