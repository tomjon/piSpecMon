import { Data} from './data';

export abstract class Chart {
  private _data: Data; // the chart data
  private plotted: boolean = false; // whether new data has been plotted yet
  private show: boolean = false; // whether the chart is to be shown (otherwise, it is hidden)
  private _timestamp: number; // timestamp of the last spectrum sweep

  set data(data: Data) {
    this._data = data;
    this.plotted = false;
    if (this.show) this._plot();
  }

  get data() {
    return this._data;
  }

  set timestamp(timestamp: number) {
    this._timestamp = timestamp;
    if (timestamp) this.plot();
  }

  get timestamp() {
    return this._timestamp;
  }

  onShow(show: boolean) {
    if (! this.show && show && ! this.plotted) this._plot();
    this.show = show;
  }

  private _plot(): void {
    this.plotted = true;
    this.plot();
  }

  abstract plot(): void;
}
