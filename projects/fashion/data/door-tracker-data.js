/* Door Tracker data registry.
   Load after the generated seed, matrix, and data-key files. It gives the
   runtime one stable namespace instead of reaching into several globals. */
(function () {
  "use strict";

  window.DOOR_TRACKER_DATA = {
    seed: typeof SEED !== "undefined" ? SEED : {},
    matrixData: typeof MATRIX_DATA !== "undefined" ? MATRIX_DATA : [],
    dataKeySeed: typeof DOOR_KEY_SEED !== "undefined" ? DOOR_KEY_SEED : []
  };
})();
