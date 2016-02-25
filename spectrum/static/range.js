define(['lib/d3/d3.v3', 'lib/d3/slider/d3.slider'], function (d3, slider) {
  "use strict";

  return function () {
    var range;

    d3.select("#go").on("click", function () {
      dispatch.range(range);
    });

    return {
      q: function () { return '/spectrum/sweep/_search?size=1&q=config_id:' + values.config_id + '&fields=timestamp&sort=timestamp:desc' },

      update: function (resp) {
        // update sweep count in UI
        d3.select("#count span").text(resp.hits.total);
        d3.select("#count").style("display", "initial");

        var start = values.start;
        var end = resp.hits.hits[0].fields.timestamp[0];

        var axis = d3.svg.axis().tickFormat(format).ticks(4);
        d3.select('#slider').selectAll("*").remove();
        var scale = d3.time.scale().domain([new Date(start), new Date(end)]);
        d3.select('#slider').call(slider().scale(scale).value([start, end]).axis(axis).on("slide", function (evt, value) {
          range = value;
        }));
        d3.select('#slider').selectAll('g.tick text').each(insertLineBreaks);
      }
    };
  };
});
