var path = require('path'),
    bin = path.join(__dirname,'..','bin'),
    exec = require('child_process').exec,
    spawn = require('child_process').spawn;

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
  /**
   * @method elevate
   * @member nodewindows
   * Elevate is similar to `sudo` on Linux/Mac. It attempts to elevate the privileges of the
   * current user to a local administrator. Using this does not require a password, but it
   * does require that the current user have administrative privileges. Without these
   * privileges, the command will fail with a `access denied` error.
   *
   * On systems with UAC enabled, this may prompt the user for permission to proceed:
   *
   * ![UAC Prompt](http://upload.wikimedia.org/wikipedia/en/5/51/Windows_7_UAC.png)
   *
   * **Syntax**:
   *
   * `elevate(cmd[,options,callback])`
   *
   * @param {String} cmd
   * The command to execute with elevated privileges. This can be any string that would be typed at the command line.
   * @param {Object} [options]
   * Any options that will be passed to `require('child_process').exec(cmd,<OPTIONS>,callback)`.
   * @param {Function} callback
   * The callback function passed to `require('child_process').exec(cmd,options,<CALLBACK>)`.
   */
  elevate: function(cmd,options,callback) {
    var p = params(options,callback);
    exec('"'+path.join(bin,'elevate','elevate.cmd')+'" '+cmd,p.options,p.callback);
  },
  /**
   * @method log
   * @member nodewindows
   * Logs an event to the Windows Event Log. 
   *
   * **Syntax**:
   *
   * `log(log,type,src,msg,id[,callback])`
   *
   * @param {String} log
   * The name of the log.
   * @param {String} type
   * THe event type of the event log entry. One of (Error, FailureAudit, Information, SuccessAudit, Warning).
   * @param {String} src
   * The source by which the application is registered.
   * @param {String} msg
   * The content of the log message.
   * @param {Number} id
   * The application-specific identifier for the event.
   * @param {Function} callback
   * The callback to be invoked after attempting to write the log entry.
   */
  log: function(log,type,src,msg,id,callback) {
    var eventCreateArgs = [
      '/L', log,
      '/T', type,
      '/SO', src,
      '/ID', id];

    var eventCreate = spawn(path.join(bin,'eventlog','eventcreate.exe'), eventCreateArgs);
    eventCreate.stdin.setEncoding('utf8');
    eventCreate.stdin.write(msg);
    eventCreate.stdin.end();

    if (callback) {
      var stdErr = '';
      var stdOut = '';

      eventCreate.stdout.on('data', function (data) {
        stdOut += data.toString();      
      });

      eventCreate.stderr.on('data', function (data) {
        stdErr += data.toString();
      });

      eventCreate.on('close', function (exitCode) {
        callback(exitCode === 0 ? null : exitCode, stdOut, stdErr);
      });
    }
  },

  /**
   * @method sudo
   * @member nodewindows
   * Sudo acts similarly to `sudo` on Linux/Mac. Unlike _elevate_, it requires a password, but it
   * will not prompt the user for permission to proceed. Like _elevate_, this
   * _still requires administrative privileges_ for the user, otherwise the command will fail.
   * The primary difference between this and _elevate()_ is the prompt.
   *
   * **Syntax**:
   *
   * `sudo(cmd,password[,options,callback])`
   *
   * @param {String} cmd
   * The command to execute with elevated privileges. This can be any string that would be typed at the command line.
   * @param {String} password
   * The password of the user
   * @param {Object} [options]
   * Any options that will be passed to `require('child_process').exec(cmd,<OPTIONS>,callback)`.
   * @param {Function} [callback]
   * The callback function passed to `require('child_process').exec(cmd,options,<CALLBACK>)`.
   */
  sudo: function(cmd,password,options,callback){
    password = password || '';
    if (typeof password !== 'string'){
      callback = options;
      options = password;
      password = '';
    }
    var p = params(options,callback);
    exec(path.join(bin,'sudowin','sudo.exe')+' '+(password !== '' ? '-p '+password:'')+cmd,p.options,p.callback);
  }
}
