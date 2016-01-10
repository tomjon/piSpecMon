define(['lib/d3/d3.v3'], function (d3) {
  "use strict";

  var units = [' bytes', 'k', 'M', 'G'];

  function convertBytes(bytes) {
    var m = Math.floor(Math.log2(bytes) / 10);
    if (m >= units.length) m = units.length - 1;
    return (bytes / Math.pow(2, 10 * m)).toFixed(1) + units[m];
  }

  return function (options) {
    return {
      update: function (stats) {
        d3.select('#totalSize').text(convertBytes(stats.size_in_bytes));
        d3.select('#records').text(stats.doc_count);
      }
    };
  };
});
