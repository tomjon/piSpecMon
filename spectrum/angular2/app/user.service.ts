import { Injectable } from '@angular/core';
import { Headers, Http, Response, RequestOptions } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { User } from './user';
import 'rxjs/add/operator/toPromise';

@Injectable()
export class UserService {
  private usersUrl = 'http://localhost:8080/user';

  constructor(private http: Http) { }

  getUsers(): Observable<User[]> {
    return this.http.get(this.usersUrl + 's')
                    .map(this.extractData)
                    .catch(this.handleError);
  }

  saveUser(user: User, password?: string): Observable<void> {
    let body = JSON.stringify(user, (k, v) => { return (! k || k[0] != '_') ? v : undefined });
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    let url = this.usersUrl + '/' + (user._name || user.name);
    if (password) {
       url += '?password=' + password;
    }

    return this.http.put(url, body, options)
                    .catch(this.handleError);
  }

  deleteUser(user: User): Observable<void> {
    return this.http.delete(this.usersUrl + '/' + user.name)
                    .catch(this.handleError);
  }

  private extractData(res: Response) {
    let data = res.json().data || [ ];
    let users = [ ];
    for (let user of data) {
      user._name = user.name; // store original name in _name
      user._count = 0; // otherwise this is unitialised
      users.push(user)
    }
    return users;
  }

  private handleError (error: any) {
    // In a real world app, we might use a remote logging infrastructure
    // We'd also dig deeper into the error to get a better message
    let errMsg = (error.message) ? error.message :
      error.status ? `${error.status} - ${error.statusText}` : 'Server error';
    return Observable.throw(errMsg);
  }
}
