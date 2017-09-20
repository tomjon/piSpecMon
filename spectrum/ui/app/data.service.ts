import { Injectable } from '@angular/core';
import { Headers, Http, RequestOptions, Response, URLSearchParams } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { User } from './user';
import { Config } from './config';
import { ErrorService } from './error.service';

@Injectable()
export class DataService {
  private baseUrl = '/';

  constructor(private http: Http, private errorService: ErrorService) { }

  getConstants(): Observable<any> {
    return this.http.get(`${this.baseUrl}constants`)
                    .map(res => res.json())
                    .catch(this.errorHandler("get UI cpnstants"));
  }

  getSettings(): Observable<any> {
    return this.http.get(`${this.baseUrl}settings`)
                    .map(res => res.json())
                    .catch(this.errorHandler("get settings"));
  }

  setSettings(key: string, values: any): Observable<void> {
    let body = JSON.stringify(values);
    let headers = new Headers({'Content-Type': 'application/json'});
    let options = new RequestOptions({headers: headers});
    return this.http.put(`${this.baseUrl}settings/${key}`, body, options)
                    .map(res => res.json())
                    .catch(this.errorHandler("set settings: " + key));
  }

  getCaps(): Observable<any> {
    return this.http.get(this.baseUrl + 'caps')
                    .map(res => res.json())
                    .catch(this.errorHandler("get rig models"));
  }

  getStats(): Observable<any> {
    return this.http.get(this.baseUrl + 'stats')
                    .map(res => res.json())
                    .catch(this.errorHandler("get data storage statistics"));
  }

  getUsers(): Observable<User[]> {
    return this.http.get(this.baseUrl + 'users')
                    .map(this.extractUserData)
                    .catch(this.errorHandler("get all user details"));
  }

  private extractUserData(res: Response) {
    let data = res.json().data || [ ];
    let users = [ ];
    for (let raw of data) {
      users.push(new User(raw));
    }
    return users;
  }

  getUser(name: string): Observable<User> {
    return this.http.get(this.baseUrl + 'user/' + name)
                    .map(res => new User(res.json().data))
                    .catch(this.errorHandler("get user details for " + name));
  }

  saveUser(user: User, password?: string): Observable<void> {
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    let url = this.baseUrl + 'user/' + user.name;
    let data: any = { user: user.data() };
    if (password) {
      data.password = password;
    }
    return this.http.put(url, JSON.stringify(data), options)
                    .map(res => res.json())
                    .catch(this.errorHandler("save user details"));
  }

  deleteUser(user: User): Observable<void> {
    return this.http.delete(this.baseUrl + 'user/' + user.name)
                    .catch(this.errorHandler("delete user"));
  }

  getCurrentUser(): Observable<User> {
    return this.http.get(this.baseUrl + 'user')
                    .map(res => new User(res.json()))
                    .catch(this.errorHandler("get current user details"));
  }

  setCurrentUser(user: User, oldPassword?: string, newPassword?: string): Observable<void> {
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    let data: any = { };
    if (user) {
      data.user = user.data();
    }
    if (oldPassword && newPassword) {
      data.oldPassword = oldPassword;
      data.newPassword = newPassword;
    }
    return this.http.post(this.baseUrl + 'user', JSON.stringify(data), options)
                    .catch(this.errorHandler("set current user details"));
  }

  getLoggedInUsers(): Observable<string[]> {
    return this.http.get(`${this.baseUrl}users?current`)
                    .map(res => res.json().data)
                    .catch(this.errorHandler("get logged in users"));
  }

  logout(): Observable<void> {
    return this.http.get(this.baseUrl + 'logout')
                    .catch(this.errorHandler("log out"));
  }

  piCommand(command: string): Observable<void> {
    return this.http.get(`${this.baseUrl}pi/${command}`)
                    .catch(this.errorHandler(`pi command: ${command}`));
  }

  getConfig(config_id?: string): Observable<Config[]> {
    let url = `${this.baseUrl}config`;
    if (config_id) url = `${url}/${config_id}`;
    return this.http.get(url)
                    .map(res => res.json().data.map(c => Object.assign(new Config(), c)))
                    .catch(this.errorHandler("get config set"));
  }

  deleteConfig(config_ids: string[]): Observable<void> {
    return this.http.delete(`${this.baseUrl}config/${config_ids.join(',')}`)
                    .catch(this.errorHandler("delete config"));
  }

  getStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}process`)
                    .map(res => res.json())
                    .catch(this.errorHandler(`get process status`));
  }

  start(workers: string[], description: string): Observable<void> {
    let body = JSON.stringify({workers: workers, description: description});
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    return this.http.put(`${this.baseUrl}process`, body, options)
                    .map(res => res.json())
                    .catch(this.errorHandler(`start process`));
  }

  stop(): Observable<void> {
    return this.http.delete(`${this.baseUrl}process`)
                    .map(res => res.json())
                    .catch(this.errorHandler(`stop process`));
  }

  exportData(config_id, worker_key: string, name: string): Observable<string> {
    return this.http.post(`${this.baseUrl}export/${config_id}?key=${worker_key}&name=${name}`, null, null)
                    .map(res => res.json().path)
                    .catch(this.errorHandler("export spectrum data"));
  }

  getData(config_id, starts, end=undefined): Observable<any> {
    let params: URLSearchParams = new URLSearchParams();
    for (let key in starts) {
      params.set('start_' + key, starts[key]);
    }
    if (end != undefined) {
      params.set('end', end);
    }
    return this.http.get(`${this.baseUrl}data/${config_id}`, {search: params})
                    .map(res => res.json())
                    .catch(this.errorHandler("get data"));
  }

  setUiSetting(key, value): Observable<void> {
    let body = JSON.stringify(value);
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    return this.http.put(`${this.baseUrl}ui/${key}`, body, options)
                    .catch(this.errorHandler("set UI setting"));
  }

  getUiSettings(): Observable<any> {
    return this.http.get(`${this.baseUrl}ui`)
                    .map(res => res.json())
                    .catch(this.errorHandler("get UI settings"));
  }

  getPicoStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}pico`)
                    .map(res => res.json())
                    .catch(this.errorHandler("get PICO status"));
  }

  private errorHandler(source: any) {
    let errors = this.errorService;
    return function (error: any, caught: Observable<any>): Observable<any> {
      errors.logError(source, `${error._body} - ${error.status} ${error.statusText}`);
      return Observable.create(observer => { observer.error() });
    };
  }
}
