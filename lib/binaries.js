var path = require('path'),
    bin = path.join(__dirname,'..','bin'),
    exec = require('child_process').exec;

var params = function(options,callback) {
  callback = callback || function(){};
  options = options || {};
  if (typeof options === 'function'){
    callback = options;
    options = {};
  }
  if (typeof options !== 'object'){
    throw 'Invalid options parameter.';
  }
  return {options:options,callback:callback}; 
}

module.exports = {
  elevate: function(cmd,options,callback) {
    var p = params(options,callback);
    exec(path.join(bin,'elevate','elevate.cmd')+' '+cmd,p.options,p.callback);
  },
  
  sudo: function(cmd,password,options,callback){
    password = password || '';
    if (typeof password !== 'string'){
      callback = options;
      options = password;
      password = '';
    }
    var p = params(otions,callback);
    exec(path.join(bin,'sudowin','sudo.exe')+' '+(password !== '' ? '-p '+password:'')+cmd,p.options,p.callback);
  }
}