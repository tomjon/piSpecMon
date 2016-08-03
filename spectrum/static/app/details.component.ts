import { Component, Input, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { User } from './user';
import { DataService } from './data.service';
import { MessageService } from './message.service';

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

  // workaround for <select> not working with object values properly
  username: string;

  @ViewChild(WidgetComponent) widgetComponent;
  @ViewChild('form') form;
  @ViewChild('passwordForm') resetForm;
  @ViewChild('newForm') newUserForm;

  constructor(private dataService: DataService, private messageService: MessageService) { }

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
    if (this.current.roleIn(['admin'])) {
      this.widgetComponent.busy(this.dataService.getUsers())
                          .subscribe(users => this.users = users.filter(user => user.name != this.current.name));
    }
  }

  // strange fix needed to stop username changing when role is changed
  changeRole() {
    let name: string = this.username;
    setTimeout(() => {
      $("#psm-username").val(name);
    });
  }

  onReset() {
    if (this.user == this.current) {
      this.widgetComponent.busy(this.dataService.getCurrentUser())
                          .subscribe(user => this.setCurrent(user));
    } else {
      this.widgetComponent.busy(this.dataService.getUser(this.user.name))
                          .subscribe(user => this.setUser(user));
    }
    this.widgetComponent.pristine(this.form);
  }

  onSubmit() {
    if (this.user == this.current) {
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
