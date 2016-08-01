import { Component, Input, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { User } from './user';
import { DataService } from './data.service';

declare var $;

@Component({
  selector: 'psm-details',
  directives: [ WidgetComponent ],
  templateUrl: 'templates/details.html'
})
export class DetailsComponent {
  @Input('user') current: User;

  roles: any = User.ROLES;

  oldPassword: string;
  newPassword: string;

  newUserName: string;
  newUserPassword: string;

  // only initialised when an administrator
  users: User[];

  user: User;

  // message for informative modal
  message: string = "No message";

  // workaround for <select> not working with object values properly
  username: string;

  @ViewChild(WidgetComponent) widgetComponent;
  @ViewChild('form') form;
  @ViewChild('passwordForm') resetForm;
  @ViewChild('newForm') newUserForm;

  constructor(private dataService: DataService) { }

  private setCurrent(user: User) {
    this.current = user;
    this.user = this.current;
  }

  private setUser(user: User) {
    this.user = user;
    for (let k in this.users) {
      if (this.users[k].name == user.name) {
        this.users[k] = user;
        break;
      }
    }
  }

  ngOnChanges() {
    this.user = this.current;
    this.username = this.user.name;
  }

  ngOnInit() {
    if (this.current.roleIn(['admin'])) {
      this.widgetComponent.busy(this.dataService.getUsers())
                          .subscribe(users => this.users = users.filter(user => user.name != this.current.name));
    }
  }

  onReset() {
    if (this.user == this.current) {
      this.widgetComponent.busy(this.dataService.getCurrentUser())
                          .subscribe(user => this.setCurrent(user));
    } else {
      this.widgetComponent.busy(this.dataService.getUser(this.user.name))
                          .subscribe(user => this.setUser(user));
    }
    this._pristine(this.form);
  }

  onSubmit() {
    if (this.user == this.current) {
      this.widgetComponent.busy(this.dataService.setCurrentUser(this.user))
                          .subscribe();
    } else {
      this.widgetComponent.busy(this.dataService.saveUser(this.user))
                          .subscribe();
    }
    this._pristine(this.form);
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

  private _pristine(form): void {
    form.form['_touched'] = false;
    form.form['_pristine'] = true;
  }

  resetPasswordForm() {
    this.oldPassword = "";
    this.newPassword = "";
    this._pristine(this.resetForm);
  }

  resetAddUserForm() {
    this.newUserName = "";
    this.newUserPassword = "";
    this._pristine(this.newUserForm);
  }

  private showMessage(message: string) {
    this.message = message;
    $("#messageModal").modal();
  }

  onPassword() {
    this.widgetComponent.busy(this.dataService.setCurrentUser(null, this.oldPassword, this.newPassword))
                        .subscribe(
                          () => this.showMessage("Password changed"),
                          () => this.showMessage("Incorrect password")
                        );
  }

  onNewUser() {
    if (this.userExists(this.newUserName)) {
      this.showMessage(`A user with the name '${this.newUserName}' already exists`);
      return;
    }
    let newUser = new User({ name: this.newUserName, role: "data" });
    this.widgetComponent.busy(this.dataService.saveUser(newUser, this.newUserPassword))
                        .subscribe(
                          () => { this.showMessage("User '" + newUser.name + "' created"); this.users.push(newUser) }
                        );
  }

  onDeleteUser() {
    this.widgetComponent.busy(this.dataService.deleteUser(this.user))
                        .subscribe(() => {
                          this.users.splice(this.users.indexOf(this.user), 1);
                          this.user = this.current;
                          this.username = this.user.name;
                        });
  }

  get loading() {
    return this.widgetComponent.loading;
  }

  // when the user name selection changes, change the modelled user (workaround for dodgy object values in select)
  changeUser() {
    this.user = this.current.name == this.username ? this.current : this.users.find(u => u.name == this.username);
  }
}
