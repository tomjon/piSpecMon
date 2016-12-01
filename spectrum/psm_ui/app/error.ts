export class Error {

  public source: any;
  public message: string;

  constructor(source: any, message: string) {
    this.source = source;
    this.message = message;
  }

}
