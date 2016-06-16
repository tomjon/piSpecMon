define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  return function (options) {
    var parent = d3.select("#waterfall-chart");

    var margin = options.margin,
         width = options.width - margin.left - margin.right,
        height = options.height - margin.top - margin.bottom;

    var x = d3.scale.linear().range([0, width]);
    var y = d3.time.scale().range([0, height]);

    var xAxis = d3.svg.axis().scale(x).orient("bottom");
    var yAxis = d3.svg.axis().scale(y).orient("left").tickFormat(format);

    var heat = d3.scale.linear().domain(options.heat).range(["blue", "yellow", "red"]).clamp(true);

    var svg = parent.append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    return {
      update: function (data) {
        svg.selectAll("*").remove();

        if (values.data_set.config.freqs.freqs || data.length == 0) {
          parent.style("display", "none");
          return;
        }
        parent.style("display", "initial");

        var f0 = +values.data_set.config.freqs.range[0];
        var f1 = +values.data_set.config.freqs.range[1];
        var df = +values.data_set.config.freqs.range[2];
        x.domain([f0 - 0.5 * df, f1 + 0.5 * df]);
        y.domain(d3.extent(data, function (d) { return d.fields.timestamp }));

        svg.append("g")
           .attr("class", "x axis")
           .attr("transform", "translate(0," + height + ")")
           .call(xAxis)
           .append("text")
           .attr("transform", "translate(" + width + ",0)")
           .attr("x", 40)
           .attr("y", 6)
           .style("text-anchor", "end")
           .text(hz[values.data_set.config.freqs.exp]);

        svg.append("g")
           .attr("class", "y axis")
           .call(yAxis)
           .append("text")
           .attr("x", 15)
           .attr("y", -10)
           .style("text-anchor", "end")
           .text("Time");

        svg.selectAll('g.y.axis g text').each(insertLineBreaks);

        var rw = width / data[0].fields.level.length;
        var rh = height / data.length;

        var g = svg.selectAll('g.row')
                   .data(data)
                   .enter().append('g').attr("class", 'row')
                   .attr('transform', function (d, i) { return 'translate(0, ' + (rh * i - 1) + ')' });

        g.selectAll('rect')
         .data(function (d) { return d.fields.level })
         .enter().append('rect')
         .attr('x', function (d, i) { return 1 + rw * i })
         .attr('width', rw + 1)
         .attr('height', rh + 1)
         .attr('style', function (d, i) { return d != null ? 'fill:' + heat(d) : 'display:none' });
      }
    };
  };
});
