export class Config {

  constructor(public id: string, public values: any, public timestamp: number, public latest: number, public count: number) {
    this.id = id;
    this.values = values;
    this.timestamp = timestamp;
    this.latest = latest;
    this.count = count;
  }

}
