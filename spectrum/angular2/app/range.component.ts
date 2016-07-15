import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { ErrorComponent } from './error.component';
import { SweepComponent } from './sweep.component';
import { DataService } from './data.service';

declare var d3: any;
declare var slider: any;

var format = d3.time.format("%d/%m/%Y %X");

@Component({
  selector: 'psm-range',
  templateUrl: 'templates/range.html'
})
export class RangeComponent {
  count: number;
  range: number[];
  format: Function; //FIXME eh? this is never initialised, but seems to work?

  @Input() config_id: string;
  @Input('sweep') sweepComponent: SweepComponent; //FIXME feels odd, this is so we can call getTimestamp()
  @Input('error') errorComponent: ErrorComponent;

  @Output() onRange = new EventEmitter<number[]>();

  @ViewChild('slider') slider;

  constructor(private dataService: DataService) { }

  ngOnChanges() {
    if (this.config_id == '') return;
    this.dataService.getRange(this.config_id)
                    .subscribe(
                      data => this.update(data),
                      error => this.errorComponent.add(error)
                    );
  }

  insertLineBreaks(d) {
    var el = d3.select(this);
    var words = format(d).split(' ');
    el.text('');

    for (var i = 0; i < words.length; i++) {
      var tspan = el.append('tspan').text(words[i]);
      if (i > 0) {
        tspan.attr('x', 0).attr('dy', '15');
      }
    }
  }

  private update(data) {
    this.count = data.hits.total;
    if (this.count == 0) return;

    var start = this.sweepComponent.getTimestamp();
    var end = data.hits.hits[0].fields.timestamp[0];
    this.range = [start, end];

    let sliderEl = this.slider.nativeElement;
    var axis = d3.svg.axis().tickFormat(this.format).ticks(4);
    d3.select(sliderEl).selectAll("*").remove();
    var scale = d3.time.scale().domain([new Date(start), new Date(end)]);
    d3.select(sliderEl).call(d3.slider().scale(scale).value([start, end]).axis(axis).on("slide", this.onSlide.bind(this)));
    d3.select(sliderEl).selectAll('g.tick text').each(this.insertLineBreaks);
  }

  onSlide(evt, value) {
    this.range = value;
  }

  onFetch() {
    this.onRange.emit(this.range);
  }
}
