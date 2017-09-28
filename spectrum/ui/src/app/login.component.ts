import { Component, Input, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { User } from './user';
import { DataService } from './data.service';
import { MessageService } from './message.service';

@Component({
  selector: 'psm-login',
  template: `
    <button type="button" class="btn btn-link" data-toggle="modal" data-target="#loggedInUsersModal">{{user.name}} ({{user._roleLabel}})</button>
    <a href="/logout" role="button" class="btn btn-link">Log Out</a>
    <button type="button" (click)="resetPasswordForm()" class="btn btn-link" data-toggle="modal" data-target="#changePasswordModal">Change Password</button>
    <div id="loggedInUsersModal" class="modal fade" role="dialog">
      <form role="form" #form="ngForm">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <button type="button" class="close" data-dismiss="modal">&times;</button>
              <h4 class="modal-title">Logged in users</h4>
            </div>
            <div class="modal-body">
              <p *ngFor="let name of loggedInUsers">{{name}}</p>
            </div>
          </div>
        </div>
      </form>
    </div>
    <div id="changePasswordModal" class="modal fade" role="dialog">
      <form role="form" #form="ngForm">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <button type="button" class="close" data-dismiss="modal">&times;</button>
              <h4 class="modal-title">Change Password</h4>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label for="old">Old password</label>
                <input type="text" required class="form-control" [(ngModel)]="oldPassword" name="old" #old="ngModel">
                <div [hidden]="old.valid || old.pristine" class="alert alert-danger">
                  Old password is a required parameter
                </div>
              </div>
              <div class="form-group">
                <label for="new">New password</label>
                <input type="text" required class="form-control" [(ngModel)]="newPassword" name="new" #new="ngModel">
                <div [hidden]="new.valid || new.pristine" class="alert alert-danger">
                  New password is a required parameter
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="submit" (click)="onPassword()" class="btn btn-default" data-dismiss="modal" [disabled]="! form.form.valid || oldPassword == newPassword">Submit</button>
              <button type="button" class="btn btn-default" data-dismiss="modal">Dismiss</button>
            </div>
          </div>
        </div>
      </form>
    </div>`
})
export class LoginComponent {
  @Input('user') user: User;

  oldPassword: string;
  newPassword: string;

  loggedInUsers: string[] = [];

  constructor(private dataService: DataService, private messageService: MessageService) { }

  ngOnInit() {
    this.dataService.getLoggedInUsers()
                    .subscribe(users => this.loggedInUsers = users);
  }

  resetPasswordForm() {
    this.oldPassword = "";
    this.newPassword = "";
  }

  onPassword() {
    this.dataService.setCurrentUser(null, this.oldPassword, this.newPassword)
                    .subscribe(
                      () => this.messageService.show("Password changed"),
                      () => this.messageService.show("Incorrect password")
                    );
  }
}
