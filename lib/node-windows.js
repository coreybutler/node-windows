if (require('os').platform().indexOf('win') < 0){
  throw 'ngn-windows is only supported on Windows.';
}

// Add binary invokers
module.exports = require('./binaries');

// Add command line shortcuts
var commands = require('./cmd');
for (var item in commands){
  module.exports[item] = commands[item];
}

// Add daemon management capabilities
module.exports.service = require('./daemon');