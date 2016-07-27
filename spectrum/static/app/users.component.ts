import { Component, Input } from '@angular/core';
import { InputComponent } from './input.component';
import { User } from './user';
import { DataService } from './data.service';
import { CHANGE_TIMEOUT } from './constants';

@Component({
  selector: 'psm-users',
  templateUrl: 'templates/users.html',
  directives: [ InputComponent ],
  styles: [ `.disabled { background: lightgrey }` ]
})
export class UsersComponent {
  //FIXME edge case: a user can log in after an administrator, so the UI should reflect that (shouldn't be able to edit them) - also should reflect any changes they make
  //FIXME show logged in users in a different background style
  //FIXME unsaved changes should be apparent to the user, maybe with a button/click to manually trigger a save. Same on details component
  //FIXME field validation

  users: User[];
  newUser: User = new User();
  roles: any = User.ROLES;

  @Input() user: User; // the logged in user

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.dataService.getUsers()
                    .subscribe(
                      users => { this.users = users; this.replaceUser() },
                      () => { }
                    );
  }

  private replaceUser() {
    if (! this.user) return;
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
                          () => { },
                          () => { }
                        );
      }
    }, CHANGE_TIMEOUT);
  }

  onDelete(user) {
    user._loading = true;
    this.dataService.deleteUser(user)
                    .subscribe(
                      () => this.users.splice(this.users.indexOf(user), 1),
                      () => { },
                      () => user._loading = false
                    );
  }

  onAdd(user) {
    for (let u of this.users) {
      if (u.name == user.name) {
        alert("User already exists");
        return;
      }
    }
    let password = prompt("Please supply an initial password");
    if (password == undefined || password == null || password == "") {
      return;
    }
    user._loading = true;
    this.dataService.saveUser(user, password)
                    .subscribe(
                       () => { this.users.push(user); this.newUser = new User() },
                       () => { },
                       () => user._loading = false
                    );
  }
}
