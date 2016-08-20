import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { DataService } from './data.service';
import { Config } from './config';
import { _d3 as d3, dt_format, insertLineBreaks } from './d3_import';

@Component({
  selector: 'psm-range',
  directives: [ WidgetComponent ],
  templateUrl: 'templates/range.html'
})
export class RangeComponent {
  count: number;
  range: number[];
  value: number[];
  config: Config;
  showing: boolean = false;

  @Output() onRange = new EventEmitter<number[]>();

  @ViewChild('slider') slider;

  constructor(private dataService: DataService) { }

  @Input('config') set _config(config: Config) {
    this.config = config;
    if (this.config.config_id == '') return;
    this.dataService.getRange(this.config.config_id)
                    .subscribe(data => {
                      this.showing = false;
                      this.count = data.count;
                      this.range = [this.config.timestamp, data.range];
                      this.value = [this.range[0], this.range[1]]; // need a literal copy
                      if (this.count > 0) this.draw();
                    });
  }

  @Input('status') set _status(status: any) {
    if (this.value && status && status.config_id == this.config.config_id && status.sweep) {
      let count = status.sweep.sweep_n; // only count complete sweeps
      if (count <= this.count) return;
      this.count = count;
      let atEnd = this.value[1] == this.range[1];
      this.range[1] = status.sweep.timestamp;
      if (atEnd) {
        this.value[1] = this.range[1];
        if (this.showing) this.onShow();
      }
      this.draw();
    }
  }

  private draw() {
    let sliderEl = this.slider.nativeElement;
    let axis = d3.svg.axis().tickFormat(dt_format).ticks(4);
    d3.select(sliderEl).selectAll("*").remove();
    let scale = d3.time.scale().domain([new Date(this.range[0]), new Date(this.range[1])]);
    let slider = d3.slider()
                   .scale(scale)
                   .axis(axis)
                   .value(this.value)
                   .on("slide", this.onSlide.bind(this));
    d3.select(sliderEl).call(slider);
    d3.select(sliderEl).selectAll('g.tick text').each(insertLineBreaks);
  }

  onSlide(evt, value) {
    this.showing = false;
    this.value = value;
    this.onRange.emit(undefined);
  }

  onShow() {
    this.showing = true;
    this.onRange.emit(this.value);
  }
}
