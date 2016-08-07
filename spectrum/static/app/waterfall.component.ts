import { Component, Input, ViewChild } from '@angular/core';
import { WidgetComponent } from './widget.component';
import { WATERFALL_CHART_OPTIONS, HZ_LABELS } from './constants';
import { _d3 as d3, dt_format, insertLineBreaks } from './d3_import';

@Component({
  selector: 'psm-waterfall',
  directives: [ WidgetComponent ],
  template: `<psm-widget [hidden]="isHidden()" title="Waterfall" class="chart">
               <svg #chart
                 viewBox="0 0 ${WATERFALL_CHART_OPTIONS.width} ${WATERFALL_CHART_OPTIONS.height}"
                 preserveAspectRatio="xMidYMid meet">
               </svg>
             </psm-widget>`
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
  rh: number;
  rw: number;

  @Input() freqs: any;
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

    this.svg = d3.select(this.chart.nativeElement)
                 .append("g")
                 .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  }

  isHidden() {
    return this.data.levels == undefined || this.freqs.freqs || this.data.levels.length < 2;
  }

  ngOnChanges() {
    if (! this.svg) return; // ngOnChanges() happens before ngOnInit()!

    this.svg.selectAll("*").remove();

    if (this.isHidden()) return;

    let data = this.data.levels;

    var f0 = +this.freqs.range[0];
    var f1 = +this.freqs.range[1];
    let df = +this.freqs.range[2];
    this.x.domain([f0 - 0.5 * df, f1 + 0.5 * df]);
    this.y.domain(d3.extent(data, d => d.fields.timestamp));

    this.svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis)
        .append("text")
        .attr("transform", "translate(" + this.width + ",0)")
        .attr("x", 40)
        .attr("y", 6)
        .style("text-anchor", "end")
        .text(HZ_LABELS[this.freqs.exp]);

    this.svg.append("g")
        .attr("class", "y axis")
        .call(this.yAxis)
        .append("text")
        .attr("x", 15)
        .attr("y", -10)
        .style("text-anchor", "end")
        .text("Time");

     this.svg.selectAll('g.y.axis g text').each(insertLineBreaks);

     this.rw = this.width / data[0].fields.level.length;
     this.rh = this.height / data.length;

     let g = this.svg.selectAll('g.row')
                 .data(data)
                 .enter().append('g').attr("class", 'row')
                 .attr('transform', (d, i) => 'translate(0, ' + (this.rh * i - 1) + ')');

     g.selectAll('rect')
      .data((d, i) => d.fields.level.map(v => [v, i]))
      .enter().append('rect')
      .attr('x', (d, i) => 1 + this.rw * i)
      .attr('width', this.rw + 1)
      .attr('height', this.rh + 1)
      .attr('style', (d, i) => d[0] != null ? 'fill:' + this.heat(d[0]) : 'display:none')
      .append('title')
      .text((d, i) => this.label(d, i));
  }

  label(d, i): string {
    return `${dt_format(this.y.invert(this.rh * d[1] - 1))} ${this.x.invert(0.95 + this.rw * i).toFixed(2)}${HZ_LABELS[this.freqs.exp]} ${d[0]}dB`;
  }
}
