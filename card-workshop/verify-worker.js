'use strict';
importScripts('./engine-harness.js');
installWorkshopEngineHarness(globalThis);
onmessage = function ({ data }) {
  try {
    importScripts('/runtime/shu-card-effects.js', '/runtime/wei-card-effects.js', '/runtime/wu-card-effects.js', '/runtime/elite-ai-info.js', '/runtime/elite-ai-effects.js', '/runtime/card-info.js', '/runtime/replacement-cards.js', '/runtime/v2-card-data.js');
    // This isolated, disposable worker has no DOM/localStorage or write endpoint.
    new Function(data.script)();
    importScripts('/runtime/script.js', '/runtime/core-v2.js', '/runtime/core-v2.test-suite.js');
    const groups = [runCoreV2RegressionTests(), runCoreV2CardBoundaryTests()];
    postMessage({ passed: groups.reduce((n, g) => n + g.passed, 0), failed: groups.reduce((n, g) => n + g.failed, 0), results: groups.flatMap(g => g.results) });
  } catch (e) { postMessage({ error: e.message }); }
};
