import { Data} from './data';
import { StateService } from './state.service';

export abstract class Chart {
  private plotted: boolean = false; // whether new data has been plotted yet
  private show: boolean = false; // whether the chart is to be shown (otherwise, it is hidden)

  constructor(protected stateService: StateService) {
    stateService.registerChart(this);
  }

  reset() {
    this.plotted = false;
    if (this.show) this._plot();
  }

  get data(): Data {
    return this.stateService.currentConfig != undefined ? this.stateService.currentConfig.data : undefined;
  }

  get timestamp(): number {
    return this.data != undefined ? this.data.timestamp : undefined;
  }

  onShow(show: boolean) {
    if (show && ! this.plotted) this._plot();
    this.show = show;
  }

  private _plot(): void {
    if (this.data == undefined) return;
    this.plotted = true;
    this.plot();
  }

  abstract plot(): void;
}
