import { Injectable } from '@angular/core';
import { Headers, Http, RequestOptions, Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { User } from './user';
import { Config } from './config';

@Injectable()
export class DataService {
  private baseUrl = 'http://localhost:8080/';

  constructor(private http: Http) { }

  getModels(): Observable<any> {
    return this.http.get(this.baseUrl + 'caps')
                    .map(res => res.json().models)
                    .catch(this.handleError);
  }

  getModes(): Observable<any> {
    return this.http.get(this.baseUrl + 'caps')
                    .map(res => res.json().modes)
                    .catch(this.handleError);
  }

  getRig(): Observable<any> {
    return this.http.get(this.baseUrl + 'rig')
                    .map(res => res.json())
                    .catch(this.handleError);
  }

  setRig(rig: any): Observable<void> {
    let body = JSON.stringify(rig);
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    return this.http.put(this.baseUrl + 'rig', body, options)
                    .map(res => res.json())
                    .catch(this.handleError);
  }

  getStats(): Observable<any> {
    return this.http.get(this.baseUrl + 'stats')
                    .map(res => res.json())
                    .catch(this.handleError);
  }

  getUsers(): Observable<User[]> {
    return this.http.get(this.baseUrl + 'users')
                    .map(this.extractUserData)
                    .catch(this.handleError);
  }

  private extractUserData(res: Response) {
    let data = res.json().data || [ ];
    let users = [ ];
    for (let raw of data) {
      users.push(new User(raw));
    }
    return users;
  }

  saveUser(user: User, password?: string): Observable<void> {
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    let url = this.baseUrl + 'user/' + (user._name || user.name);
    let data: any = { user: user.data() };
    if (password) {
      data.password = password;
    }
    return this.http.put(url, JSON.stringify(data), options)
                    .map(res => res.json())
                    .catch(this.handleError);
  }

  deleteUser(user: User): Observable<void> {
    return this.http.delete(this.baseUrl + 'user/' + user.name)
                    .catch(this.handleError);
  }

  getLogin(): Observable<User> {
    return this.http.get(this.baseUrl + 'login')
                    .map(res => new User(res.json().data, true))
                    .catch(this.handleError);
  }

  setPassword(oldPassword, newPassword): Observable<User> {
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    let body = JSON.stringify({ oldPassword: oldPassword, newPassword: newPassword });
    return this.http.post(this.baseUrl + "login", body, options)
                    .map(res => res.json())
                    .catch(this.handleError);
  }

  logout(): Observable<void> {
    return this.http.get(this.baseUrl + 'logout')
                    .catch(this.handleError);
  }

  getConfig(config_id: string): Observable<Config> {
    let url = this.baseUrl + 'spectrum/config/' + config_id + '?fields=json,timestamp';
    return this.http.get(url)
                    .map(res => this.extractConfigSet(config_id, res))
                    .catch(this.handleError);
  }

  private extractConfigSet(config_id: string, res: Response): Config {
    let fields: any = res.json().fields;
    return new Config(config_id, +fields.timestamp[0], JSON.parse(fields.json[0]));
  }

  getSweepSets(): Observable<any> {
    return this.http.get(this.baseUrl + 'spectrum/config/_search?size=10000&fields=*')
                    .map(this.extractSweepData)
                    .catch(this.handleError);
  }

  deleteSweepSet(config_id): Observable<void> {
    return this.http.delete(this.baseUrl + 'spectrum/config/' + config_id)
                    .catch(this.handleError);
    //FIXME doesn't delete sweep data!  But all these spectrum/** requests should use a dedicated server API anyway
  }

  private extractSweepData(res: Response) {
    let hits = res.json().hits.hits || [ ];
    let sets = [ ];
    for (let hit of hits) {
      sets.push({
                  config_id: hit._id,
                  timestamp: hit.fields.timestamp[0],
                  fields: JSON.parse(hit.fields.json[0])
               });
    }
    return sets;
  }

  getMonitor(): Observable<any> {
    return this.http.get(this.baseUrl + 'monitor')
                    .map(res => res.json())
                    .catch(this.handleError);
  }

  startMonitor(config: any): Observable<void> {
    let body = JSON.stringify(config);
    let headers = new Headers({ 'Content-Type': 'application/json' });
    let options = new RequestOptions({ headers: headers });
    return this.http.put(this.baseUrl + 'monitor', body, options)
                    .map(res => res.json())
                    .catch(this.handleError);
  }

  stopMonitor(): Observable<void> {
    return this.http.delete(this.baseUrl + 'monitor')
                    .map(res => res.json())
                    .catch(this.handleError);
  }

  exportData(config_id): Observable<string> {
    return this.http.post(this.baseUrl + 'export/' + config_id, null, null)
                    .map(res => res.json().path)
                    .catch(this.handleError);
  }

  getRange(config_id): Observable<any> {
    let url = 'spectrum/sweep/_search?size=1&q=config_id:' + config_id + '&fields=timestamp&sort=timestamp:desc';
    return this.http.get(this.baseUrl + url)
                    .map(res => res.json())
                    .catch(this.handleError);
  }

  getData(config_id, range): Observable<any> {
    let q = 'config_id:' + config_id + '+AND+timestamp:[' + range[0] + '+TO+' + range[1] + ']';
    let url = 'spectrum/sweep/_search?size=1000000&q=' + q + '&fields=*&sort=timestamp';
    return this.http.get(this.baseUrl + url)
                    .map(res => res.json().hits.hits)
                    .catch(this.handleError);
  }

  private handleError(error: any) {
    return Observable.throw(`${error.status} ${error.statusText} - ${error._body}`);
  }
}
