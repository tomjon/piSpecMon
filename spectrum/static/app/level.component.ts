import { Component, Input, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { LEVEL_CHART_OPTIONS, HZ_LABELS, MAX_N } from './constants';
import { _d3 as d3, dt_format, insertLineBreaks } from './d3_import';

@Component({
  selector: 'psm-level',
  directives: [ WidgetComponent ],
  template: `<psm-widget [hidden]="isHidden()" title="Level / Time" class="chart">
               <form class="form-inline" role="form">
                 <div class="form-group">
                   <label for="top">Top</label>
                   <select class="form-control" #selectN [(ngModel)]="N" (ngModelChange)="ngOnChanges()" name="top"></select>
                 </div>
                 <div class="form-group">
                   <label for="by">by</label>
                   <select class="form-control" [(ngModel)]="top" (ngModelChange)="ngOnChanges()" name="by">
                     <option value="avg">Average</option>
                     <option value="max">Maximum</option>
                     <option value="min">Minimum</option>
                   </select>
                 </div>
               </form>
               <svg #chart
                 viewBox="0 0 ${LEVEL_CHART_OPTIONS.width} ${LEVEL_CHART_OPTIONS.height}"
                 preserveAspectRatio="xMidYMid meet">
               </svg>
             </psm-widget>`
})
export class LevelComponent {
  top: string = 'avg';
  N: number = 1;

  svg: any;
  colour: any;
  x: any;
  y: any;
  xAxis: any;
  yAxis: any;
  height: number;
  width: number;

  @Input() freqs: any;
  @Input() data: any;

  @ViewChild('chart') chart;
  @ViewChild('selectN') selectN;

  constructor() { }

  ngOnInit() {
    let margin = LEVEL_CHART_OPTIONS.margin;
    this.width = LEVEL_CHART_OPTIONS.width - margin.left - margin.right,
    this.height = LEVEL_CHART_OPTIONS.height - margin.top - margin.bottom;

    this.x = d3.time.scale().range([0, this.width]);
    this.y = d3.scale.linear().range([this.height, 0]);

    this.xAxis = d3.svg.axis().scale(this.x).orient("bottom").tickFormat(dt_format);
    this.yAxis = d3.svg.axis().scale(this.y).orient("left");

    this.colour = d3.scale.category10();

    this.svg = d3.select(this.chart.nativeElement)
                 .append("g")
                 .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    d3.select(this.selectN.nativeElement)
      .selectAll("option")
      .data(d3.range(1, MAX_N + 1))
      .enter().append("option")
      .text(d => d);
  }

  isHidden() {
    return this.data.levels == undefined || this.data.levels.length == 0;
  }

  ngOnChanges() {
    if (! this.svg) return; // ngOnChanges() happens before ngOnInit()!

    this.svg.selectAll("*").remove();

    if (this.isHidden()) return;

    let data = this.data.levels;
    let agg = this.data.agg[this.top];
    let freq_idxs = this.data.freq_idxs;

    for (let i = 0; i < this.N; ++i) {
      if (freq_idxs[this.top][i] == undefined) {
        this.N = i;
        break;
      }
    }
    freq_idxs = freq_idxs[this.top].slice(0, this.N);

    this.x.domain(d3.extent(data, d => d.fields.timestamp));
    if (LEVEL_CHART_OPTIONS.y_axis) {
      this.y.domain([LEVEL_CHART_OPTIONS.y_axis[0], LEVEL_CHART_OPTIONS.y_axis[1]]);
      this.yAxis.tickValues(d3.range(LEVEL_CHART_OPTIONS.y_axis[0], LEVEL_CHART_OPTIONS.y_axis[1] + LEVEL_CHART_OPTIONS.y_axis[2], LEVEL_CHART_OPTIONS.y_axis[2]));
    } else {
      this.y.domain([
        d3.min(data, function (d) { return d3.min(d.timestamp.buckets, function (v) { return v.level.value }) }),
        d3.max(data, function (d) { return d3.max(d.timestamp.buckets, function (v) { return v.level.value }) })
      ]);
    }

    this.svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis)
        .append("text")
        .attr("transform", "translate(" + this.width + ",0)")
        .attr("x", 40)
        .attr("y", 6)
        .style("text-anchor", "end")
        .text("Time");

    this.svg.selectAll('g.x.axis g text').each(insertLineBreaks);

    this.svg.append("g")
        .attr("class", "y axis")
        .call(this.yAxis)
        .append("text")
        .attr("x", -10)
        .attr("y", -10)
        .text("dB");

    let freq = this.svg.selectAll(".freq")
                   .data(freq_idxs)
                   .enter().append("g")
                   .attr("class", "freq");

    freq.append("path")
        .attr("class", "line")
        .attr("d", idx => {
          let line = d3.svg.line().interpolate("monotone")
                       .x(d => this.x(d.fields.timestamp))
                       .y(d => this.y(d.fields.level[idx]))
                       .defined(d => d.fields.level[idx] != null);
          return line(data);
        })
        .style("stroke", d => this.colour(d));

    let discreteFn = idx => {
      let freq = this.freqs.freqs[idx];
      return (+freq.f).toFixed(3) + ' ' + HZ_LABELS[freq.exp];
    };

    let rangeFn = idx => {
      var range = this.freqs.range;
      var f = +range[0] + idx * +range[2];
      return +f.toFixed(3) + ' ' + HZ_LABELS[this.freqs.exp];
    };

    freq.append("text")
        .attr("x", this.width + 10)
        .attr("y", (idx, i) => 16 * i)
        .attr("dy", 12)
        .text(this.freqs.freqs ? discreteFn : rangeFn)
        .style("stroke", idx => this.colour(idx));
  }
}
