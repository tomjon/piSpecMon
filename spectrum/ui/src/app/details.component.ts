import { Component, Input, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { WidgetBase } from './widget.base';
import { User } from './user';
import { DataService } from './data.service';
import { StateService } from './state.service';
import { MessageService } from './message.service';

declare var $;

@Component({
  selector: 'psm-details',
  template: `<psm-widget title="User Details">
              <div class="form-group">
                <label for="name">User name</label>
                <input *ngIf="! users" [disabled]="loading" type="text" readonly class="form-control" [(ngModel)]="user.name">
                <select *ngIf="users" [disabled]="loading" class="form-control" id="psm-username" [(ngModel)]="username" (ngModelChange)="changeUser()">
                  <option>{{logged_in.name}}</option>
                  <option *ngIf="usersWithRole('admin').length > 0" disabled>&nbsp;</option>
                  <optgroup *ngIf="usersWithRole('admin').length > 0" label="Administrators">
                    <option *ngFor="let u of usersWithRole('admin')">{{u.name}}</option>
                  </optgroup>
                  <option *ngIf="usersWithRole('freq').length > 0" disabled>&nbsp;</option>
                  <optgroup *ngIf="usersWithRole('freq').length > 0" label="Frequency Setters">
                    <option *ngFor="let u of usersWithRole('freq')">{{u.name}}</option>
                  </optgroup>
                  <option *ngIf="usersWithRole('data').length > 0" disabled>&nbsp;</option>
                  <optgroup *ngIf="usersWithRole('data').length > 0" label="Data Viewers">
                    <option *ngFor="let u of usersWithRole('data')">{{u.name}}</option>
                  </optgroup>
                </select>
              </div>
              <form role="form" #form="ngForm">
                <div class="form-group">
                  <label for="role">Role</label>
                  <input *ngIf="user == logged_in" [disabled]="loading" type="text" readonly class="form-control" [(ngModel)]="user._roleLabel" name="role">
                  <select *ngIf="user != logged_in" [disabled]="loading" class="form-control" [(ngModel)]="user.role" (ngModelChange)="_fix()" name="role">
                    <option *ngFor="let r of roles" [ngValue]="r.role">{{r.label}}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="real">Real name</label>
                  <input [disabled]="loading" type="text" required class="form-control" [(ngModel)]="user.real" name="real" #real="ngModel">
                  <div [hidden]="real.valid || real.pristine" class="alert alert-danger">
                    Real name is a required parameter
                  </div>
                </div>
                <div class="form-group">
                  <label for="email">Email address</label>
                  <input [disabled]="loading" type="text" required class="form-control" [(ngModel)]="user.email" name="email" #email="ngModel">
                  <div [hidden]="email.valid || email.pristine" class="alert alert-danger">
                    Email address is a required parameter
                  </div>
                </div>
                <div class="form-group">
                  <label for="tel">Telephone number</label>
                  <input [disabled]="loading" type="text" required class="form-control" [(ngModel)]="user.tel" name="tel" #tel="ngModel">
                  <div [hidden]="tel.valid || tel.pristine" class="alert alert-danger">
                    Telephone number is a required parameter
                  </div>
                </div>
                <button (click)="onReset()" class="btn btn-default" [disabled]="loading || form.form.pristine">Reset</button>
                <button (click)="onSubmit()" class="btn btn-default" [disabled]="loading || ! form.form.valid || form.form.pristine">Submit</button>
                <button *ngIf="users" (click)="onDeleteUser()" class="btn btn-default" [disabled]="loading || user == logged_in">Delete</button>
                <button *ngIf="users" (click)="resetAddUserForm()" class="btn btn-link" [disabled]="loading" data-toggle="modal" data-target="#newUserModal">New</button>
              </form>
              <div id="newUserModal" class="modal fade" role="dialog">
                <form role="form" #newForm="ngForm">
                  <div class="modal-dialog">
                    <div class="modal-content">
                      <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal">&times;</button>
                        <h4 class="modal-title">Add New User</h4>
                      </div>
                      <div class="modal-body">
                          <div class="form-group">
                            <label for="old">User name</label>
                            <input type="text" required pattern="[a-zA-Z0-9]+" class="form-control" [(ngModel)]="newUserName" name="name" #name="ngModel">
                            <div [hidden]="name.valid || name.pristine" class="alert alert-danger">
                              User name is a required parameter, and must be alphanumeric
                            </div>
                          </div>
                          <div class="form-group">
                            <label for="new">Initial password</label>
                            <input type="password" required class="form-control" [(ngModel)]="newUserPassword" name="password" #password="ngModel">
                            <div [hidden]="password.valid || password.pristine" class="alert alert-danger">
                              Initial password is a required parameter
                            </div>
                          </div>
                      </div>
                      <div class="modal-footer">
                        <button type="submit" (click)="onNewUser()" class="btn btn-default" data-dismiss="modal" [disabled]="! newForm.form.valid">Submit</button>
                        <button type="button" class="btn btn-default" data-dismiss="modal">Dismiss</button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </psm-widget>`
})
export class DetailsComponent extends WidgetBase {
  logged_in: User;

  roles: any = User.ROLES;

  oldPassword: string;
  newPassword: string;

  newUserName: string;
  newUserPassword: string;

  // only initialised when an administrator
  users: User[];

  user: User;

  // workaround for <select> not working with object values properly
  username: string;

  @ViewChild('form') form;

  @ViewChild('passwordForm') resetForm;
  @ViewChild('newForm') newUserForm;

  constructor(private dataService: DataService, stateService: StateService, private messageService: MessageService) { super() }

  ngOnInit() {
    this.onReset();
  }

  private setCurrent(user: User) {
    this.logged_in = user;
    this.user = this.logged_in;
  }

  private setUser(user: User) {
    this.user = user;
    this.username = user.name;
    for (let k in this.users) {
      if (this.users[k].name == user.name) {
        this.users[k] = user;
        break;
      }
    }
    this._fix();
  }

  @Input('user') set _user(user: User) {
    this.logged_in = user;
    this.user = this.logged_in;
    this.username = this.user.name;
    if (user.roleIn(['admin'])) {
      this.widgetComponent.busy(this.dataService.getUsers())
                          .subscribe(users => this.users = users.filter(u => u.name != user.name));
    }
  }

  // strange fix needed to stop username changing when role is changed or user is reset
  _fix() {
    let name: string = this.username;
    setTimeout(() => {
      $("#psm-username").val(name);
    });
  }

  onReset() {
    if (this.user == this.logged_in) {
      this.widgetComponent.busy(this.dataService.getCurrentUser())
                          .subscribe(user => this.setCurrent(user));
    } else {
      this.widgetComponent.busy(this.dataService.getUser(this.user.name))
                          .subscribe(user => this.setUser(user));
    }
    this.widgetComponent.pristine(this.form);
  }

  onSubmit() {
    if (this.user == this.logged_in) {
      this.widgetComponent.busy(this.dataService.setCurrentUser(this.user))
                          .subscribe();
    } else {
      this.widgetComponent.busy(this.dataService.saveUser(this.user))
                          .subscribe();
    }
    this.widgetComponent.pristine(this.form);
  }

  usersWithRole(role: string) {
    return this.users.filter(u => u.role == role);
  }

  userExists(name: string): boolean {
    if (! this.users) return false;
    for (let u of this.users) {
      if (u.name == name) return true;
    }
    return false;
  }

  resetAddUserForm() {
    this.newUserName = "";
    this.newUserPassword = "";
    this.widgetComponent.pristine(this.newUserForm);
  }

  onNewUser() {
    if (this.userExists(this.newUserName)) {
      this.messageService.show(`A user with the name '${this.newUserName}' already exists`);
      return;
    }
    let newUser = new User({ name: this.newUserName, role: "data" });
    this.widgetComponent.busy(this.dataService.saveUser(newUser, this.newUserPassword))
                        .subscribe(
                          () => { this.messageService.show("User '" + newUser.name + "' created"); this.users.push(newUser) }
                        );
  }

  onDeleteUser() {
    this.widgetComponent.busy(this.dataService.deleteUser(this.user))
                        .subscribe(() => {
                          this.users.splice(this.users.indexOf(this.user), 1);
                          this.user = this.logged_in;
                          this.username = this.user.name;
                        });
  }

  get loading() {
    return this.widgetComponent.loading;
  }

  // when the user name selection changes, change the modelled user (workaround for dodgy object values in select)
  changeUser() {
    this.user = this.logged_in.name == this.username ? this.logged_in : this.users.find(u => u.name == this.username);
  }
}
