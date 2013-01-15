if (require('os').platform().indexOf('win') < 0){
  throw 'ngn-windows is only supported on Windows.';
}

module.exports = require('./binaries');
module.exports.service = require('./daemon');
