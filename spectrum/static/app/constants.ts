export var TICK_INTERVAL = 1000;
export var HZ_LABELS = { 0: 'Hz', 3: 'kHz', 6: 'MHz', 9: 'GHz' };
export var MAX_N = 10;

export var CHART_WIDTH = 1200;
export var CHART_HEIGHT = 400;
export var FREQUENCY_CHART_OPTIONS: any = { y_axis: [-70, 70, 10], margin: { top: 25, left: 80, right: 80, bottom: 30 }, width: CHART_WIDTH, height: CHART_HEIGHT };
export var LEVEL_CHART_OPTIONS: any = { y_axis: [-70, 70, 10], margin: { top: 30, left: 40, right: 200, bottom: 40 }, width: CHART_WIDTH, height: CHART_HEIGHT, x_ticks: 7 };
export var WATERFALL_CHART_OPTIONS: any = { heat: [-70, 0, 70], margin: { top: 25, left: 80, right: 80, bottom: 30 }, width: CHART_WIDTH, height: CHART_HEIGHT, y_ticks: 7 };
export var AUDIO_CHART_OPTIONS: any = { margin: { top: 20, left: 80, right: 80, bottom: 30 }, width: CHART_WIDTH, height: CHART_HEIGHT, y_ticks: 10 };
