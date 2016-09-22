import { Injectable } from '@angular/core';
import { Headers, Http, RequestOptions, Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { User } from './user';
import { Config } from './config';
import { ErrorService } from './error.service';

@Injectable()
export class DataService {
  private baseUrl = '/';

  constructor(private http: Http, private errorService: ErrorService) { }

  getVersion(): Observable<any> {
    return this.http.get(this.baseUrl + 'version')
                    .map(res => res.text())
                    .catch(this.errorHandler("get version"));
  }

  getCaps(): Observable<any> {
    return this.http.get(this.baseUrl + 'caps')
                    .map(res => res.json())
                    .catch(this.errorHandler("get rig models"));
  }

  getRig(): Observable<any> {
    return this.http.get(this.baseUrl + 'rig')
                    .map(res => res.json())
                    .catch(this.errorHandler("get rig configuration"));
  }

  setRig(rig: any): Observable<void> {
    let body = JSON.stringify(rig);
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    return this.http.put(this.baseUrl + 'rig', body, options)
                    .map(res => res.json())
                    .catch(this.errorHandler("set rig configuration"));
  }

  getAudio(): Observable<any> {
    return this.http.get(this.baseUrl + 'audio')
                    .map(res => res.json())
                    .catch(this.errorHandler("get audio configuration"));
  }

  setAudio(audio: any): Observable<void> {
    let body = JSON.stringify(audio);
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    return this.http.put(this.baseUrl + 'audio', body, options)
                    .map(res => res.json())
                    .catch(this.errorHandler("set audio configuration"));
  }

  getRds(): Observable<any> {
    return this.http.get(this.baseUrl + 'rds')
                    .map(res => res.json())
                    .catch(this.errorHandler("get RDS configuration"));
  }

  setRds(audio: any): Observable<void> {
    let body = JSON.stringify(audio);
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    return this.http.put(this.baseUrl + 'rds', body, options)
                    .map(res => res.json())
                    .catch(this.errorHandler("set RDS configuration"));
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

  logout(): Observable<void> {
    return this.http.get(this.baseUrl + 'logout')
                    .catch(this.errorHandler("log out"));
  }

  getConfig(config_id: string): Observable<Config> {
    let url = this.baseUrl + 'config/' + config_id;
    return this.http.get(url)
                    .map(res => {
                      let data = res.json().data[0];
                      return new Config(data.id, data.values, +data.timestamp, +data.first, +data.latest, +data.count);
                    })
                    .catch(this.errorHandler("get config set"));
  }

  getConfigs(): Observable<Config[]> {
    return this.http.get(this.baseUrl + 'config')
                    .map(res => res.json().data.map(c => new Config(c.id, c.values, c.timestamp, c.first, c.latest, c.count)))
                    .catch(this.errorHandler("get scan configs"));
  }

  deleteConfigs(config_ids: string[]): Observable<void> {
    return this.http.delete(this.baseUrl + 'configs/' + config_ids.join(','))
                    .catch(this.errorHandler("delete config"));
  }

  getMonitor(): Observable<any> {
    return this.http.get(this.baseUrl + 'monitor')
                    .map(res => res.json())
                    .catch(this.errorHandler("get monitor status"));
  }

  startMonitor(config: any): Observable<void> {
    let body = JSON.stringify(config);
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    return this.http.put(this.baseUrl + 'monitor', body, options)
                    .map(res => res.json())
                    .catch(this.errorHandler("start monitor"));
  }

  stopMonitor(): Observable<void> {
    return this.http.delete(this.baseUrl + 'monitor')
                    .map(res => res.json())
                    .catch(this.errorHandler("stop monitor"));
  }

  exportData(config_id): Observable<string> {
    return this.http.post(this.baseUrl + 'export/' + config_id, null, null)
                    .map(res => res.json().path)
                    .catch(this.errorHandler("export spectrum data"));
  }

  getData(config_id, range): Observable<any> {
    return this.http.get(`${this.baseUrl}data/${config_id}?start=${Math.round(range[0])}&end=${Math.round(range[1]) + 5}`)
                    .map(res => res.json())
                    .catch(this.errorHandler("get data"));
  }

  private errorHandler(source: any) {
    let errors = this.errorService;
    return function (error: any, caught: Observable<any>): Observable<any> {
      errors.logError(source, `${error._body} - ${error.status} ${error.statusText}`);
      return Observable.create(observer => { observer.error() });
    };
  }
}
