define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  function nullArray() {
    var a = [];
    for (var n = 0; n < maxN; ++n) {
      a.push(null);
    }
    return a;
  }

  return function (widgets) {
    var data, agg, freq_idxs;

    return {
      q: function () {
        var q = 'config_id:' + values.config_id;
        if (values.range) {
          q += '+AND+timestamp:[' + values.range[0] + '+TO+' + values.range[1] + ']';
        }
        return '/spectrum/sweep/_search?size=1000000&q=' + q + '&fields=*&sort=timestamp'
      },

      update: function (resp) {
        d3.selectAll("#charts").style("display", "initial");

        data = resp.hits.hits;

        agg = { latest: [], min: [], max: [], avg: [] };
        freq_idxs = { 'min': nullArray(), 'max': nullArray(), 'avg': nullArray() };

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

          /* find top N by avg, min and max */
          for (var x in freq_idxs) {
            // see if it beats any, if so swap and keep looking down the list... drop off end and gets kicked out
            for (var idx = 0; idx < agg[x].length; ++idx) {
              var v = agg[x][idx].v;

              if (idx > 0 && idx + 1 < agg[x].length) {
                if (agg[x][idx - 1].v >= v || v < agg[x][idx + 1].v) {
                  continue;
                }
              }

              var i = idx;
              // try slotting in our value
              for (var n = 0; n < maxN; ++n) {
                var slot_idx = freq_idxs[x][n];
                // if we find an empty slot, just use it and quit
                if (slot_idx == null) {
                  freq_idxs[x][n] = i;
                  break;
                }
                var slot_v = agg[x][slot_idx].v;
                // otherwise, compare with each slot, swapping if we beat it
                if ((x == 'min' && v < slot_v) || (x != 'min' && v > slot_v)) {
                  var tmp = i;
                  i = slot_idx;
                  freq_idxs[x][n] = tmp;
                  v = slot_v;
                }
              }
            }
          }
        }

        // update average sweep time in UI
        if (data.length > 0) {
          var mt = total_time / (1000 * data.length);
          d3.select("#avg span").text(mt < 1 ? "<1s" : mt.toFixed(1) + "s");
          d3.select("#avg").style("display", "initial");
        } else {
          d3.select("#avg").style("display", "none");
        }

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
