import { Component, Input, ViewChild } from '@angular/core';
import { ErrorComponent } from './error.component';

declare var d3: any;

var hz = { 0: 'Hz', 3: 'kHz', 6: 'MHz', 9: 'GHz' }; //FIXME constant used elsewhere
var format = d3.time.format("%d/%m/%Y %X"); //FIXME repeat from range component
var options = { y_axis: [-70, 70, 10], margin: { top: 50, left: 60, right: 85, bottom: 40 }, width: 1200, height: 400 };

var maxN = 10; //FIXME repeat from charts component

@Component({
  selector: 'psm-level',
  template: `<div [hidden]="isHidden()">
               <h2>Level / Time</h2>
               <label>Top</label>
               <select #selectN [(ngModel)]="N" (ngModelChange)="ngOnChanges()"></select>
               <label>by</label>
               <select [(ngModel)]="top" (ngModelChange)="ngOnChanges()">
                 <option value="avg">Average</option>
                 <option value="max">Maximum</option>
                 <option value="min">Minimum</option>
               </select>
               <div #chart></div>
             </div>`
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

  @Input() config: any; //FIXME combine with the config_id, if you need it (or might happen anyway)
  @Input() data: any;
  @Input('error') errorComponent: ErrorComponent;

  @ViewChild('chart') chart;
  @ViewChild('selectN') selectN;

  constructor() { }

  ngOnInit() {
    let margin = options.margin;
    this.width = options.width - margin.left - margin.right,
    this.height = options.height - margin.top - margin.bottom;

    this.x = d3.time.scale().range([0, this.width]);
    this.y = d3.scale.linear().range([this.height, 0]);

    this.xAxis = d3.svg.axis().scale(this.x).orient("bottom").tickFormat(format);
    this.yAxis = d3.svg.axis().scale(this.y).orient("left");

    this.colour = d3.scale.category10();

    var parent = d3.select(this.chart.nativeElement);
    this.svg = parent.append("svg")
                     .attr("width", this.width + margin.left + margin.right)
                     .attr("height", this.height + margin.top + margin.bottom)
                     .append("g")
                     .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    //FIXME surely there's an angular way to do this?
    d3.select(this.selectN.nativeElement)
      .selectAll("option")
      .data(d3.range(1, maxN + 1))
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
    if (options.y_axis) {
      this.y.domain([options.y_axis[0], options.y_axis[1]]);
      this.yAxis.tickValues(d3.range(options.y_axis[0], options.y_axis[1] + options.y_axis[2], options.y_axis[2]));
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

    this.svg.selectAll('g.x.axis g text').each(this.insertLineBreaks);

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
      let freq = this.config.freqs.freqs[idx];
      return (+freq.f).toFixed(3) + ' ' + hz[freq.exp];
    };

    let rangeFn = idx => {
      var range = this.config.freqs.range;
      var f = +range[0] + idx * +range[2];
      return +f.toFixed(3) + ' ' + hz[this.config.freqs.exp];
    };

    freq.append("text")
        .attr("x", this.width + 10)
        .attr("y", (idx, i) => 16 * i)
        .attr("dy", 12)
        .text(this.config.freqs.freqs ? discreteFn : rangeFn)
        .style("stroke", idx => this.colour(idx));
  }

  insertLineBreaks(d) { //FIXME Repeated in RangeComponent
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
}
