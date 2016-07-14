import { Component, Input, ViewChild } from '@angular/core';
import { ErrorComponent } from './error.component';

declare var d3: any;

var hz = { 0: 'Hz', 3: 'kHz', 6: 'MHz', 9: 'GHz' }; //FIXME constant used elsewhere
var format = d3.time.format("%d/%m/%Y %X"); //FIXME repeat from range component
var options = { heat: [-70, 0, 70], margin: { top: 50, left: 80, right: 50, bottom: 40 }, width: 1200, height: 400 };

@Component({
  selector: 'psm-waterfall',
  template: `<div #chart></div>`
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
    this.y = d3.time.scale().range([0, this.height]);

    this.xAxis = d3.svg.axis().scale(this.x).orient("bottom");
    this.yAxis = d3.svg.axis().scale(this.y).orient("left").tickFormat(format);

    this.heat = d3.scale.linear().domain(options.heat).range(["blue", "yellow", "red"]).clamp(true);

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

    if (this.data == undefined || this.config.freqs.freqs || this.data.length == 0) {
      return;
    }

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
        .text(hz[this.config.freqs.exp]);

    this.svg.append("g")
        .attr("class", "y axis")
        .call(this.yAxis)
        .append("text")
        .attr("x", 15)
        .attr("y", -10)
        .style("text-anchor", "end")
        .text("Time");

     this.svg.selectAll('g.y.axis g text').each(this.insertLineBreaks);

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
