define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  return function (options) {
    return {
      update: function (stats) {
        d3.select('#totalSize').text(convertBytes(stats.size_in_bytes));
        d3.select('#records').text(stats.doc_count);
      }
    };
  };
});
