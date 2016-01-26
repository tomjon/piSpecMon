define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  return function (widgets) {
    var data, agg, freq_idxs;

    return {
      q: function () { return '/spectrum/sweep/_search?size=1000000&q=config_id:' + values.config_id + '&fields=*&sort=timestamp' },

      update: function (resp) {
        data = resp.hits.hits;

        // update sweep count in UI
        d3.select("#count span").text(data.length);

        /* find top N by avg, min and max */
        agg = { latest: [], min: [], max: [], avg: [] };
        freq_idxs = { 'min': [], 'max': [], 'avg': [] };

        /* also compute sweep time */
        var total_time = 0.0;

        if (data.length > 0) {
          for (var freq_idx in data[data.length - 1].fields.level) {
            // take into account failed readings (level -128)
            var level = data[data.length - 1].fields.level[freq_idx];
            agg['latest'][freq_idx] = { idx: freq_idx, v: level != -128 ? level : null };
          }
          for (var sweep_idx in data) {
            total_time += data[sweep_idx].fields.totaltime[0];

            for (var freq_idx in data[sweep_idx].fields.level) {
              var level = data[sweep_idx].fields.level[freq_idx];
              if (level == -128) {
                // failed reading, remove from data
                data[sweep_idx].fields.level[freq_idx] = null;
                continue;
              }
              if (agg['min'][freq_idx] == null || level < agg['min'][freq_idx].v) {
                agg['min'][freq_idx] = { idx: freq_idx, v: level };
              }
              if (agg['max'][freq_idx] == null || level > agg['max'][freq_idx].v) {
                agg['max'][freq_idx] = { idx: freq_idx, v: level };
              }
              if (agg['avg'][freq_idx] == null) {
                agg['avg'][freq_idx] = { idx: freq_idx, v: 0 };
              }
              agg['avg'][freq_idx].v += level / data.length;
            }
          }
          agg['min'].sort(function (x, y) { return x.v - y.v });
          agg['max'].sort(function (x, y) { return y.v - x.v });
          agg['avg'].sort(function (x, y) { return y.v - x.v });

          for (var x in freq_idxs) {
            //FIXME: decide properly what to do here... 5 is currently the max N value in the UI
            for (var n = 0; n < Math.min(5, agg[x].length); ++n) {
              freq_idxs[x][n] = agg[x][n].idx;
            }
          }
        }

        // update average sweep time in UI
        var mt = total_time / (1000 * data.length);
        d3.select("#avg").text(mt < 1 ? "<1s" : mt.toFixed(1) + "s");

        widgets.frequency.update(agg);
        widgets.level.update(data, agg, freq_idxs);
        widgets.waterfall.update(data);
      },

      updateFreq: function () {
        if (data != null) {
          widgets.frequency.update(agg);
        }
      },

      updateLevel: function () {
        if (data != null) {
          widgets.level.update(data, agg, freq_idxs);
        }
      }
    };
  };
});
