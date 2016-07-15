export var TICK_INTERVAL = 1000;
export var HZ_LABELS = { 0: 'Hz', 3: 'kHz', 6: 'MHz', 9: 'GHz' };
export var MAX_N = 10;

export var CHART_WIDTH = 1200;
export var CHART_HEIGHT = 400;
export var FREQUENCY_CHART_OPTIONS = { y_axis: [-70, 70, 10], margin: { top: 50, left: 60, right: 50, bottom: 40 }, width: CHART_WIDTH, height: CHART_HEIGHT };
export var LEVEL_CHART_OPTIONS = { y_axis: [-70, 70, 10], margin: { top: 50, left: 60, right: 85, bottom: 40 }, width: CHART_WIDTH, height: CHART_HEIGHT };
export var WATERFALL_CHART_OPTIONS = { heat: [-70, 0, 70], margin: { top: 50, left: 80, right: 50, bottom: 40 }, width: CHART_WIDTH, height: CHART_HEIGHT };
