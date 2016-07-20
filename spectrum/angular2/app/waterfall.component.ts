import { Component, Input, ViewChild } from '@angular/core';
import { WATERFALL_CHART_OPTIONS, HZ_LABELS } from './constants';
import { _d3 as d3, dt_format, insertLineBreaks } from './d3_import';

@Component({
  selector: 'psm-waterfall',
  template: `<div [hidden]="isHidden()">
               <h2>Waterfall</h2>
               <div #chart>
             </div>`
})
export class WaterfallComponent {
  svg: any;
  heat: any;
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
    let margin = WATERFALL_CHART_OPTIONS.margin;
    this.width = WATERFALL_CHART_OPTIONS.width - margin.left - margin.right,
    this.height = WATERFALL_CHART_OPTIONS.height - margin.top - margin.bottom;

    this.x = d3.scale.linear().range([0, this.width]);
    this.y = d3.time.scale().range([0, this.height]);

    this.xAxis = d3.svg.axis().scale(this.x).orient("bottom");
    this.yAxis = d3.svg.axis().scale(this.y).orient("left").tickFormat(dt_format);

    this.heat = d3.scale.linear().domain(WATERFALL_CHART_OPTIONS.heat).range(["blue", "yellow", "red"]).clamp(true);

    let parent = d3.select(this.chart.nativeElement);
    this.svg = parent.append("svg")
                     .attr("width", this.width + margin.left + margin.right)
                     .attr("height", this.height + margin.top + margin.bottom)
                     .append("g")
                     .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  }

  isHidden() {
    return this.data == undefined || this.config.freqs.freqs || this.data.length == 0;
  }

  ngOnChanges() {
    if (! this.svg) return; // ngOnChanges() happens before ngOnInit()!

    this.svg.selectAll("*").remove();

    if (this.isHidden()) return;

    let f0 = +this.config.freqs.range[0];
    let f1 = +this.config.freqs.range[1];
    let df = +this.config.freqs.range[2];
    this.x.domain([f0 - 0.5 * df, f1 + 0.5 * df]);
    this.y.domain(d3.extent(this.data, d => d.fields.timestamp));

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
        .attr("x", 15)
        .attr("y", -10)
        .style("text-anchor", "end")
        .text("Time");

     this.svg.selectAll('g.y.axis g text').each(insertLineBreaks);

     let rw = this.width / this.data[0].fields.level.length;
     let rh = this.height / this.data.length;

     let g = this.svg.selectAll('g.row')
                 .data(this.data)
                 .enter().append('g').attr("class", 'row')
                 .attr('transform', (d, i) => 'translate(0, ' + (rh * i - 1) + ')');

     g.selectAll('rect')
         .data(d => d.fields.level)
         .enter().append('rect')
         .attr('x', (d, i) => 1 + rw * i)
         .attr('width', rw + 1)
         .attr('height', rh + 1)
         .attr('style', (d, i) => d != null ? 'fill:' + this.heat(d) : 'display:none');
  }
}
