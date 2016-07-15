import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { SweepComponent } from './sweep.component';
import { DataService } from './data.service';
import { ErrorService } from './error.service';
import { _d3 as d3, dt_format, insertLineBreaks } from './d3_import';

@Component({
  selector: 'psm-range',
  templateUrl: 'templates/range.html'
})
export class RangeComponent {
  count: number;
  range: number[];

  @Input() config_id: string;
  @Input('sweep') sweepComponent: SweepComponent; //FIXME feels odd, this is so we can call getTimestamp()

  @Output() onRange = new EventEmitter<number[]>();

  @ViewChild('slider') slider;

  constructor(private dataService: DataService, private errorService: ErrorService) { }

  ngOnChanges() {
    if (this.config_id == '') return;
    this.dataService.getRange(this.config_id)
                    .subscribe(
                      data => this.update(data),
                      error => this.errorService.logError(this, error)
                    );
  }

  private update(data) {
    this.count = data.hits.total;
    if (this.count == 0) return;

    var start = this.sweepComponent.getTimestamp();
    var end = data.hits.hits[0].fields.timestamp[0];
    this.range = [start, end];

    let sliderEl = this.slider.nativeElement;
    var axis = d3.svg.axis().tickFormat(dt_format).ticks(4);
    d3.select(sliderEl).selectAll("*").remove();
    var scale = d3.time.scale().domain([new Date(start), new Date(end)]);
    d3.select(sliderEl).call(d3.slider().scale(scale).value([start, end]).axis(axis).on("slide", this.onSlide.bind(this)));
    d3.select(sliderEl).selectAll('g.tick text').each(insertLineBreaks);
  }

  onSlide(evt, value) {
    this.range = value;
  }

  onFetch() {
    this.onRange.emit(this.range);
  }
}
