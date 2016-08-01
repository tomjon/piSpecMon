import { Component, Input, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { User } from './user';
import { DataService } from './data.service';
import { MessageService } from './message.service';

@Component({
  selector: 'psm-login',
  directives: [ WidgetComponent ],
  templateUrl: 'templates/login.html'
})
export class LoginComponent {
  @Input('user') user: User;

  oldPassword: string;
  newPassword: string;

  @ViewChild(WidgetComponent) widgetComponent;
  @ViewChild('form') form;

  constructor(private dataService: DataService, private messageService: MessageService) { }

  resetPasswordForm() {
    this.oldPassword = "";
    this.newPassword = "";
    this.widgetComponent.pristine(this.form);
  }

  onPassword() {
    this.widgetComponent.busy(this.dataService.setCurrentUser(null, this.oldPassword, this.newPassword))
                        .subscribe(
                          () => this.messageService.show("Password changed"),
                          () => this.messageService.show("Incorrect password")
                        );
  }
}
