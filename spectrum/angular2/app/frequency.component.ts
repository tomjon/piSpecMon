import { Component, Input, ViewChild } from '@angular/core';
import { ErrorComponent } from './error.component';

declare var d3: any;

var hz = { 0: 'Hz', 3: 'kHz', 6: 'MHz', 9: 'GHz' }; //FIXME constant used elsewhere
var options = { y_axis: [-70, 70, 10], margin: { top: 50, left: 60, right: 50, bottom: 40 }, width: 1200, height: 400 };

@Component({
  selector: 'psm-frequency',
  template: `<select [(ngModel)]="sweep" (ngModelChange)="ngOnChanges()">
               <option default value="latest">Latest sweep</option>
               <option value="avg">Average</option>
               <option value="max">Maximum</option>
               <option value="min">Minimum</option>
             </select>
             <div #chart></div>`
})
export class FrequencyComponent {
  sweep: string = 'latest';

  svg: any;
  line: any;
  x: any;
  y: any;
  xAxis: any;
  yAxis: any;
  height: number;
  width: number;

  @Input() config: any; //FIXME combine with the config_id, if you need it (or might happen anyway)
  @Input() data: any;
  @Input('error') errorComponent: ErrorComponent;

  @ViewChild('chart') chart;

  constructor() { }

  ngOnInit() {
    let margin = options.margin;
    this.width = options.width - margin.left - margin.right,
    this.height = options.height - margin.top - margin.bottom;

    this.x = d3.scale.linear().range([0, this.width]);
    this.y = d3.scale.linear().range([this.height, 0]);

    this.xAxis = d3.svg.axis().scale(this.x).orient("bottom");
    this.yAxis = d3.svg.axis().scale(this.y).orient("left");

    this.line = d3.svg.line().interpolate("monotone")
                  .y(d => this.y(d.v))
                  .defined(d => d.v != null);

    let parent = d3.select(this.chart.nativeElement);
    this.svg = parent.append("svg")
                     .attr("width", this.width + margin.left + margin.right)
                     .attr("height", this.height + margin.top + margin.bottom)
                     .append("g")
                     .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  }

  ngOnChanges() {
    if (! this.svg) return; // ngOnChanges() happens before ngOnInit()!

    this.svg.selectAll("*").remove();

    if (this.data == undefined) return;

    let agg = this.data[this.sweep];
    if (this.config.freqs.freqs || agg.length == 0) return;

    this.x.domain([this.config.freqs.range[0], this.config.freqs.range[1]]);
    if (options.y_axis) {
      this.y.domain([options.y_axis[0], options.y_axis[1]]);
      this.yAxis.tickValues(d3.range(options.y_axis[0], options.y_axis[1] + options.y_axis[2], options.y_axis[2]));
    } else {
      this.y.domain(d3.extent(agg, d => d.v));
    }

    this.line.x((d, i) => this.x(+this.config.freqs.range[0] + i * this.config.freqs.range[2]));

    this.svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis)
        .append("text")
        .attr("transform", "translate(" + this.width + ",0)")
        .attr("x", 40)
        .attr("y", 6)
        .style("text-anchor", "end")
        .text(hz[this.config.freqs.exp]);

    this.svg.append("g")
        .attr("class", "y axis")
        .call(this.yAxis)
        .append("text")
        .attr("x", -10)
        .attr("y", -10)
        .text("dB");

    this.svg.append("path")
        .datum(agg)
        .attr("class", "line")
        .attr("d", this.line);
  }
}
