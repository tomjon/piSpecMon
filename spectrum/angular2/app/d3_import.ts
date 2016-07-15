declare var d3: any;

export var _d3: any = d3;

export var dt_format = d3.time.format("%d/%m/%Y %X");

export var insertLineBreaks = function (d) {
  var el = d3.select(this);
  var words = dt_format(d).split(' ');
  el.text('');

  for (let i = 0; i < words.length; i++) {
    var tspan = el.append('tspan').text(words[i]);
    if (i > 0) {
      tspan.attr('x', 0).attr('dy', '15');
    }
  }
}
