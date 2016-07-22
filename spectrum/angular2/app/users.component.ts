import { Component, Input } from '@angular/core';
import { InputComponent } from './input.component';
import { User } from './user';
import { DataService } from './data.service';
import { ErrorService } from './error.service';
import { CHANGE_TIMEOUT } from './constants';

@Component({
  selector: 'psm-users',
  templateUrl: 'templates/users.html',
  directives: [ InputComponent ],
  styles: [ `.disabled { background: lightgrey }` ]
})
export class UsersComponent {
  @Input() user: User; // the logged in user
  users: User[];
  newUser: User = new User();
  roles: any = User.ROLES;

  constructor(private dataService: DataService, private errorService: ErrorService) { }

  ngOnInit() {
    this.dataService.getUsers()
                    .subscribe(
                      users => { this.users = users; this.replaceUser() },
                      error => this.errorService.logError(this, error)
                    );
  }

  private replaceUser() {
    for (let i = 0; i < this.users.length; ++i) {
      if (this.users[i].name == this.user.name) {
        this.users[i] = this.user;
      }
    }
  }

  onChange(user) {
    ++user._count;
    setTimeout(() => {
      if (--user._count == 0) {
        this.dataService.saveUser(user)
                        .subscribe(
                          () => user._name = user.name,
                          error => this.errorService.logError(this, error)
                        );
      }
    }, CHANGE_TIMEOUT);
  }

  onDelete(user) {
    user._loading = true;
    this.dataService.deleteUser(user)
                    .subscribe(
                      () => this.users.splice(this.users.indexOf(user), 1),
                      error => this.errorService.logError(this, error),
                      () => user._loading = false
                    );
  }

  onAdd(user) {
    let password = prompt("Please supply an initial password");
    if (password == undefined || password == null || password == "") {
      return;
    }
    user._loading = true;
    this.dataService.saveUser(user, password)
                    .subscribe(
                       () => { this.users.push(user); user._name = user.name; this.newUser = new User() },
                       error => this.errorService.logError(this, error),
                       () => user._loading = false
                    );
  }
}
