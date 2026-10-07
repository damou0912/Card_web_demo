// Run both suites in-process; this also works in environments that disallow child processes.
require('./model.test.cjs');
require('./server.test.cjs');
require('./presets.test.cjs');
require('./web-effects.test.cjs');
