define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  function formatBucket(d) {
    var time = new Date(d.fields.timestamp[0]);
    var config = JSON.parse(d.fields.json[0]);
    var s = format(time) + '   ';
    if (config.freqs.range) {
      var u = hz[config.freqs.exp];
      s += config.freqs.range[0] + u + ' - ' + config.freqs.range[1] + u;
    } else if (config.freqs.freqs) {
      var freqs = config.freqs.freqs;
      for (var idx in config.freqs.freqs) {
        s += freqs[idx].f + hz[freqs[idx].exp];
        if (idx < config.freqs.freqs.length - 1) {
          s += ', ';
        }
        if (idx > 2) {
          s += '...';
          break;
        }
      }
    }
    return s;
  }

  return function (options) {
    return function (parent, dispatch) {
      var select = parent.select("select");
      select.on("change", function () {
        dispatch.config_id(d3.select(this).property('value'));
      });

      return {
        q: "spectrum/config/_search?size=100&fields=*",

        render: function (resp) {
          var options = select.selectAll('option.set')
                              .data(resp.hits.hits);
          options.enter().append('option')
                 .attr("class", "set")
                 .text(formatBucket)
                 .attr('value', function (d) { return d._id });
          options.exit().remove();

          dispatch.config_id(select.property('value'));
        }
      };
    }
  };
});
