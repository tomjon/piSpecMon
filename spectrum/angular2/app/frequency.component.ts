import { Component, Input, ViewChild } from '@angular/core';
import { FREQUENCY_CHART_OPTIONS, HZ_LABELS } from './constants';
import { _d3 as d3 } from './d3_import';

@Component({
  selector: 'psm-frequency',
  template: `<div [hidden]="isHidden()">
               <h2>Level / Frequency</h2>
               <select [(ngModel)]="sweep" (ngModelChange)="ngOnChanges()">
                 <option default value="latest">Latest sweep</option>
                 <option value="avg">Average</option>
                 <option value="max">Maximum</option>
                 <option value="min">Minimum</option>
               </select>
               <div #chart></div>
             </div>`
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

  @Input() config: any;
  @Input() data: any;

  @ViewChild('chart') chart;

  constructor() { }

  ngOnInit() {
    let margin = FREQUENCY_CHART_OPTIONS.margin;
    this.width = FREQUENCY_CHART_OPTIONS.width - margin.left - margin.right,
    this.height = FREQUENCY_CHART_OPTIONS.height - margin.top - margin.bottom;

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

  isHidden() {
    return this.data == undefined || this.config.freqs.freqs || this.data[this.sweep].length == 0;
  }

  ngOnChanges() {
    if (! this.svg) return; // ngOnChanges() happens before ngOnInit()!

    this.svg.selectAll("*").remove();

    if (this.isHidden()) return;

    let agg = this.data[this.sweep];

    this.x.domain([this.config.freqs.range[0], this.config.freqs.range[1]]);
    if (FREQUENCY_CHART_OPTIONS.y_axis) {
      this.y.domain([FREQUENCY_CHART_OPTIONS.y_axis[0], FREQUENCY_CHART_OPTIONS.y_axis[1]]);
      this.yAxis.tickValues(d3.range(FREQUENCY_CHART_OPTIONS.y_axis[0], FREQUENCY_CHART_OPTIONS.y_axis[1] + FREQUENCY_CHART_OPTIONS.y_axis[2], FREQUENCY_CHART_OPTIONS.y_axis[2]));
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
        .text(HZ_LABELS[this.config.freqs.exp]);

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
