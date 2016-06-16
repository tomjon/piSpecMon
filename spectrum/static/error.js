define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  return function () {
    return {
      q: function () { return '/spectrum/error/_search?q=config_id:' + values.data_set.config_id + '&fields=json' },

      update: function (resp) {
        var hits = resp.hits ? resp.hits.hits : [];
        var error = hits.length > 0 ? JSON.parse(hits[0].fields.json[0]) : '';
        d3.select("#error").text(error);
      }
    };
  };
});
