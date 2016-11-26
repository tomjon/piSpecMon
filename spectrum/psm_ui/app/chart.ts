import { Data} from './data';

export abstract class Chart {
  private _data: Data; // the chart data
  private plotted: boolean = false; // whether new data has been plotted yet
  private show: boolean = false; // whether the chart is to be shown (otherwise, it is hidden)

  constructor (private timeout: number = 0) {}

  set data(data: Data) {
    this._data = data;
    this.plotted = false;
    if (this.show) this._plot();
  }

  get data() {
    return this._data;
  }

  onShow(show: boolean) {
    if (! this.show && show && ! this.plotted) this._plot();
    this.show = show;
  }

  private _plot(): void {
    this.plotted = true;
    setTimeout(() => this.plot(), this.timeout);
  }

  abstract plot(): void;
}
