define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  return function (params) {
    var parent = d3.select("#frequency-chart");

    var margin = params.margin,
         width = params.width - margin.left - margin.right,
        height = params.height - margin.top - margin.bottom;

    var x = d3.scale.linear().range([0, width]);
    var y = d3.scale.linear().range([height, 0]);

    var xAxis = d3.svg.axis().scale(x).orient("bottom");
    var yAxis = d3.svg.axis().scale(y).orient("left");

    var line = d3.svg.line().interpolate("monotone")
                 .y(function (d) { return y(d.v) })
                 .defined(function (d) { return d.v != null });

    var svg = parent.append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    return {
      update: function (agg) {
        svg.selectAll("*").remove();

        var sweep = d3.select("#sweep").property("value");
        agg = agg[sweep];

        if (values.data_set.config.freqs.freqs || agg.length == 0) {
          parent.style("display", "none");
          return;
        }
        parent.style("display", "initial");

        x.domain([values.data_set.config.freqs.range[0], values.data_set.config.freqs.range[1]]);
        if (params.y_axis) {
          y.domain([params.y_axis[0], params.y_axis[1]]);
          yAxis.tickValues(d3.range(params.y_axis[0], params.y_axis[1] + params.y_axis[2], params.y_axis[2]));
        } else {
          y.domain(d3.extent(agg, function (d) { return d.v }));
        }

        line.x(function (d, i) { return x(+values.data_set.config.freqs.range[0] + i * values.data_set.config.freqs.range[2]) });

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
           .attr("x", -10)
           .attr("y", -10)
           .text("dB");

        svg.append("path")
           .datum(agg)
           .attr("class", "line")
           .attr("d", line);
      }
    };
  };
});
