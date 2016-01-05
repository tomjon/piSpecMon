define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  return function (options) {
    return function (parent) {
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
        q: function (config_id) {
          return 'spectrum/sweep/_search?size=10000&q=config_id:' + config_id + '&fields=*';
        },

        clear: function() {
          svg.selectAll("*").remove();
        },

        render: function (resp, opts, conf) {
          if (conf.freqs.freqs) {
            return false;
          }

          var data = resp.hits.hits;
          if (data.length == 0) {
            return;
          }

          data.sort(function (x, y) { return x.fields.timestamp - y.fields.timestamp });

          var f0 = +conf.freqs.range[0];
          var f1 = +conf.freqs.range[1];
          var df = +conf.freqs.range[2];
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
             .text(hz[conf.freqs.exp]);

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
                     .attr('transform', function (d, i) { return 'translate(0, ' + rh * i + ')' });

          g.selectAll('rect')
           .data(function(d) { return d.fields.level })
           .enter().append('rect')
           .attr('x', function (d, i) { return rw * i })
           .attr('width', rw)
           .attr('height', rh)
           .attr('style', function (d, i) { return 'fill:' + heat(d) });
        }
      };
    };
  };
});
