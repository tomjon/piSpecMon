export class Config {

  constructor(public id: string, public values: any, public timestamp: number, public first: number, public latest: number, public count: number, public errors: any[]) {
    this.id = id;
    this.values = values;
    this.timestamp = timestamp;
    this.first = first;
    this.latest = latest;
    this.count = count;
    this.errors = errors;
  }

}
