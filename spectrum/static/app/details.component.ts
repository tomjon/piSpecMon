import { Component, ViewChild } from '@angular/core';
import { InputComponent } from './input.component';
import { WidgetComponent } from './widget.component';
import { User } from './user';
import { DataService } from './data.service';
import { ErrorService } from './error.service';

@Component({
  selector: 'psm-details',
  directives: [ WidgetComponent, InputComponent ],
  templateUrl: 'templates/details.html'
})
export class DetailsComponent {
  user: User = new User();
  oldPassword: string = "";
  newPassword: string = "";

  @ViewChild(WidgetComponent) widgetComponent;
  @ViewChild('form') form;

  constructor(private dataService: DataService, private errorService: ErrorService) { }

  ngOnInit() {
    this.widgetComponent.busy(this.dataService.getCurrentUser())
                        .subscribe(user => { this.user = user; this.checkSuperior() });
  }

  onReset() {
    this.widgetComponent.busy(this.dataService.getCurrentUser())
                        .subscribe(user => this.user = user);
    this._pristine();
  }

  private checkSuperior() {
    if (this.user._superior) {
      let s = this.user._superior;
      this.errorService.logError("Log in", `Downgraded to Data Viewer. ${s.real} is logged in as ${s._roleLabel} - contact them at ${s.email} or on ${s.tel}`);
    }
  }

  onSubmit() {
    this.widgetComponent.busy(this.dataService.setCurrentUser(this.user))
                        .subscribe();
    this._pristine();
  }

  private _pristine(): void {
    this.form.form['_touched'] = false;
    this.form.form['_pristine'] = true;
  }

  resetPasswords() {
    this.oldPassword = "";
    this.newPassword = "";
  }

  onPassword() {
    this.widgetComponent.busy(this.dataService.setCurrentUser(null, this.oldPassword, this.newPassword))
                        .subscribe();
  }

  get loading() {
    return this.widgetComponent.loading;
  }
}
