#!/usr/bin/env node

var https = require('https');
var fs = require('fs');

var download = function(url, dest, cb) {
  var file = fs.createWriteStream(dest);
  var request = https.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb);  // close() is async, call cb after close completes.
    });
  }).on('error', function(err) { // Handle errors
    fs.unlink(dest); // Delete the file async. (But we don't check the result)
    if (cb) cb(err.message);
  });
};

download("https://raw.githubusercontent.com/e-mission/e-mission-data-collection/master/www/ui/ionic/js/collect-settings.js", "www/js/control/collect-settings.js", function(message) {
    console.log("Data collection settings javascript updated");
});

download("https://raw.githubusercontent.com/e-mission/e-mission-data-collection/master/www/ui/ionic/templates/main-collect-settings.html", "www/templates/control/main-collect-settings.html", function(message) {
    console.log("Data collection settings template updated");
});

download("https://raw.githubusercontent.com/e-mission/cordova-server-sync/master/www/ui/ionic/js/sync-settings.js", "www/js/control/sync-settings.js", function(message) {
    console.log("Sync collection settings javascript updated");
});

download("https://raw.githubusercontent.com/e-mission/cordova-server-sync/master/www/ui/ionic/templates/main-sync-settings.html", "www/templates/control/main-sync-settings.html", function(message) {
    console.log("Sync collection settings template updated");
});
