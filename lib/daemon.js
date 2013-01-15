var exec = require('child_process').exec,
    path = require('path'),
    nssm = path.join(__dirname,'..','bin','nssm','win'+(require('os').arch().indexOf('64')>0 ? '64':'32'),'nssm.exe')
    PermError = 'Permission Denied. Requires administrative privileges.',
    wincmd = require('./binaries');

// Check for permission errors
var checkPermError = function(error){
  if (error.message.indexOf('Administrator access') >= 0 || error.message.indexOf('Access is denied') >= 0){
    console.log(PermError);
    logger.error(PermError);
    process.exit(1);
  } else {
    console.log(error.toString());
    logger.error(error.toString());
    process.exit(1);
  }
};

var execute = function(cmd,options,callback) {
  
  callback = callback || function(){};
  options = options || {};
  
  wincmd.isAdminUser(function(isAdmin){
    if (isAdmin) {
      if (typeof options === 'function'){
        callback = options;
        options = {};
      }
      if (daemon.user.account !== null && daemon.user.password !== null){
        _cmd = "runas /profile /user:"+daemon.user.domain+"\\"+daemon.user.account+" "+cmd;
        exec(cmd,options,callback);
      } else if (daemon.sudo.password !== null){
        // If the user is not an admin, but a sudo password is provided for admin,
        // attempt to launch using sudo.
        wincmd.sudo(cmd,daemon.sudo.password||'',options,callback);
      } else {
        wincmd.elevate(cmd,options,callback)
      }
    } else {
      console.log(PermError);
      throw PermError;
    }
  });
}

// Daemon functionality.
var daemon = {};

Object.defineProperties(daemon,{
  
  _name: {
    enumerable: false,
    writable: true,
    value: null
  },
  
  _eventlog:{
    enumerable: false,
    writable: true,
    value: null
  },
  
  eventlog: {
    enumerable: true,
    get: function(){
      if (this._eventlog !== null)
        return this._eventlog;
      if (daemon.name == null)
        throw 'No name was specified for the service';
      var EL = require('windows-eventlog').EventLog;
      this._eventlog = new EL(this.name);
      return this._eventlog;
    }
  },
  
  logger: {
    enumerable: false,
    get: function(){
      var me = this;
      return {
        info: function(msg){
          msg = msg || null
          if (msg !== null){
            me.eventlog.log(msg,'Information');
          }
        },
        error: function(msg){
          msg = msg || 'Unknown Error';
          me.eventlog.log(msg,'Error');
        },
        warn: function(msg){
          me.eventlog.log(msg,'Warning');
        }
      }
    }
  },
  
  name: {
    enumerable: false,
    get: function(){return this._name;},
    set: function(value){this._name = value;}
  },
  
  user: {
    enumerable: false,
    writable: true,
    value: {
      account: null,
      password: null,
      domain: process.env.COMPUTERNAME
    }
  },
  
  sudo: {
    enumerable:false,
    writable: true,
    value: {
      password: null
    }
  },
  
  // Create and/or start a service.
  start: { 
    enumerable: true,
    writable: false,
    value: function(svcName,file,pidfile,callback){
      callback = callback || function(){};
      this.name = svcName;
      var logger = this.logger;
    
      if (typeof pidfile === 'function'){
        callback = pidfile;
        pidfile = null;
      }
    
      if (svcName == undefined || svcName == null){
        throw "A name for the service is required.";
      }
    
      execute('net start "'+svcName+'"',function(err,stdout,stderr){
        if (err){
          if (err.code == 2){
            if (err.message.indexOf('already been started') >= 0 && err.message.indexOf('service name is invalid') < 0){
              logger.warn('An attempt to start the service failed because the service is already running. The process should be stopped before starting, or the restart method should be used.');
              callback(err);
              return;
            } else if (err.message.indexOf('service name is invalid') < 0){
              checkPermError(err);
              console.log(err);
              return;
            }
  
            if (file == undefined || file == null){
              throw "No file provided.";
            }
            
            // Construct the service command
            execute(nssm+' install "'+svcName+'" "'+process.execPath+'" "'+file+'"',function(error,stdout,stderr){
              if (error){
                checkPermError(error);
              } else if (stderr.trim().length > 0){
                logger.error(stderr);
              } else {
                daemon.start(svcName,file,pidfile,callback);
              }
            });
          } else {
            logger.error(err.toString());
          }
        } else {
          logger.info('Started Successfully.');
          callback();
        }
      })
    }
  },
  
  // Stop an existing service.
  stop: { 
    enumerable: true,
    writable: false,
    value: function(svcName,callback){
      callback = callback || function(){};
      this.name = svcName;
      var logger = this.logger;
    
      execute('net stop "'+svcName+'"',function(err,stdout,stderr){
        if (err){
          if (err.code == 2){
            logger.warn('An attempt to stop the service failed because the service is/was not running.');
            callback();
            return;
          } else {
            checkPermError(err);
          }
        } else if (stderr.trim().length > 0){
          logger.error(stderr);
        } else {
          logger.info('Successfully Stopped.');
          callback();
        }
      });
    }
  },
  
  // Restart an existing service
  restart: { 
    enumerable: true,
    writable: false,
    value: function(svcName,file,pidfile){
      pidfile = pidfile || null;
      this.name = svcName;
    
      daemon.stop(svcName,function(){
        daemon.start(svcName,file,pidfile)
      });
    }
  },
  
  // Uninstall the service
  remove: { 
    enumerable: true,
    writable: false,
    value: function(svcName,callback){
      callback=callback||function(){};
      this.name = svcName;
      var logger = this.logger;
    
      daemon.stop(svcName,function(){
        console.log('Removing '+svcName+' service.');
        execute(nssm+' remove "'+svcName+'" confirm',function(error,stdout,stderr){
          if (error){
            switch (error.code){
              case 3:
                console.log(svcName+' could not be found.');
                break;
              case 4:
                console.log('Service is running.');
                console.log('Stopping '+svcName+'...');
                daemon.stop(svcName,function(){
                  daemon.remove(svcName,callback);
                });
                break;
              default:
                console.log(error);
            }
            checkPermError(error);
          } else if (stderr.trim().length > 0){
            console.log('Error: ',stderr);
            logger.error(stderr);
          } else {
            logger.warn('Service Removed.');
            callback();
          }
        });
      });
    }
  }
});

// Export functionality for the module.
module.exports = daemon;