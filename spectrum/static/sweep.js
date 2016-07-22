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

  return function () {
    var times = {};

    var select = d3.selectAll("#data_set, #freqs_set");
    select.on("change", function () {
      var select_id = d3.select(this).attr('id');
      var id = d3.select(this).property('value');
      dispatch.config_id(select_id, id, times[id]);
    });

    return {
      q: function() { return '/spectrum/config/_search?size=10000&fields=*' },

      update: function (data) {
        select.selectAll('option.set').remove();
        var options = select.selectAll('option.set')
                            .data(data.hits.hits);
        options.enter().append('option')
               .attr("class", "set")
               .text(formatBucket)
               .attr('value', function (d) { times[d._id] = d.fields.timestamp[0]; return d._id })
      },

      selectLatest: function () {
        var options = select.selectAll("option");
        var value = options[0][options[0].length - 1].value;
        select.property("value", value);
        dispatch.config_id("data_set", value, times[value]);
        dispatch.config_id("freqs_set", value, times[value]);
      }
    };
  };
});
