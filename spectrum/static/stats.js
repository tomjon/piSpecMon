define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  /* HTML field ids, and their values from Elasticsearch output */
  function fields(stats) {
    return {
      'records': stats ? stats.docs.count : null,
      'totalSize': stats ? stats.store.size_in_bytes : null
    };
  }

  return function (options) {
    return function (parent) {
      var nodes = {};
      var values = fields();
      for (var id in values) {
        nodes[id] = d3.select('#' + id);
        nodes[id].text(values[id]);
      }

      return {
        // FIXME: couldn't you get the ids from the parent node? then can simplify fields() above
        q: 'spectrum/_stats/docs,store',

        render: function (resp) {
          var values = fields(resp.indices.spectrum.primaries);
          for (var id in values) {
            if (values[id]) {
              nodes[id].text(values[id]);
            }
          }
        }
      };
    }
  };
});
