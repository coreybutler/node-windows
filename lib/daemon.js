var exec = require('child_process').exec,
    path = require('path'),
    nssm = path.join(__dirname,'..','bin','nssm','win'+(require('os').arch().indexOf('64')>0 ? '64':'32'),'nssm.exe')
    EventLog = null,
    isPrivileged = null,
    PermError = 'Permission Denied. Requires administrative privileges.',
    wincmd = require('./binaries');

// Generic Logger
var logger = {
  logger: function(log){
    if (EventLog !== null)
      return EventLog;
    EventLog = new require('windows-eventlog').EventLog(log);
    return EventLog;
  },
  info: function(logfile,msg){
    logger.logger(logfile).log(msg,'Information');
  },
  error: function(logfile,msg){
    msg = msg || 'Unknown Error';
    logger.logger(logfile).log(msg,'Error');
  },
  warn: function(logfile,msg){
    logger.logger(logfile).log(msg,'Warning');
  }
};

// Check for permission errors
var checkPermError = function(error){
  if (error.message.indexOf('Administrator access') >= 0){
    logger.error(PermError);
    process.exit(1);
  } else {
    logger.error(error.toString());
    process.exit(1);
  }
};

// Daemon functionality.
var daemon = {
  
  user: {
    account: null,
    password: null,
    domain: process.env.COMPUTERNAME
  },
  
  sudo: {
    password: null
  },
  
  // Create and/or start a service.
  start: function(svcName,file,pidfile,callback){
    callback = callback || function(){};
    if (typeof pidfile === 'function'){
      callback = pidfile;
      pidfile = null;
    }
    if (svcName == undefined || svcName == null){
      throw "A name for the service is required.";
    }
    exec('net start "'+svcName+'"',function(err,stdout,stderr){
      if (err){
        if (err.code == 2){
          if (err.message.indexOf('already been started') >= 0 && err.message.indexOf('service name is invalid') < 0){
            logger.warn(svcName,'An attempt to start the service failed because the service is already running. The process should be stopped before starting, or the restart method should be used.');
            callback();
            return;
          } else if (err.message.indexOf('service name is invalid') < 0){
            console.log(err);
            return;
          }

          if (file == undefined || file == null){
            throw "No file provided.";
          }
          
          // Construct the service command
          wincmd.isAdminUser(function(isAdmin){
            var installed = function(error,stdout,stderr){
                              if (error){
                                checkPermError(error);
                              } else if (stderr.trim().length > 0){
                                logger.error(svcName,stderr);
                              } else {
                                daemon.start(svcName,file,pidfile,callback);
                              }
                            },
                cmd = null,
                installCmd = nssm+' install "'+svcName+'" "'+process.execPath+'" "'+file+'"'; 
            
            // If the user is not an admin, attempt to run as the specified admin user.
            if (!isAdmin){
              if (daemon.user.account !== null && daemon.user.password !== null){
                cmd = "runas /profile /user:"+daemon.user.domain+"\\"+daemon.user.account+" "+installCmd;
                exec(cmd,installed);
              } else if (daemon.sudo.password !== null){
                // If the user is not an admin, but a sudo password is provided for admin,
                // attempt to launch using sudo.
                wincmd.sudo(installCmd,daemon.sudo.password||'',installed);
              } else {
                throw PermError;
              }
            } else {
              wincmd.elevate(installCmd,installed);
            }
          });
        } else {
          logger.error(svcName,err.toString());
        }
      } else {
        logger.info(svcName,'Started Successfully.');
        callback();
      }
    })
  },
  
  // Stop an existing service.
  stop: function(svcName,callback){
    callback = callback || function(){};
    exec('net stop "'+svcName+'"',function(err,stdout,stderr){
      if (err){
        if (err.code == 2){
          logger.warn(svcName,'An attempt to stop the service failed because the service is/was not running.');
          callback();
          return;
        } else {
          checkPermError(err);
        }
      } else if (stderr.trim().length > 0){
        logger.error(svcName,stderr);
      } else {
        logger.info(svcName,'Successfully Stopped.');
        callback();
      }
    });
  },
  
  // Restart an existing service
  restart: function(svcName,file,pidfile){
    pidfile = pidfile || null;
    daemon.stop(svcName,function(){
      daemon.start(svcName,file,pidfile)
    });
  },
  
  // Uninstall the service
  remove: function(svcName,callback){
    callback=callback||function(){};
    
    wincmd.isAdminUser(function(isAdmin){
      var uninstalled = function(error,stdout,stderr){
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
          logger.error(svcName,stderr);
        } else {
          logger.warn(svcName,'Service Removed.');
          callback();
        }
      };
      var rmCmd = nssm+' remove "'+svcName+'" confirm';
      
      daemon.stop(svcName,function(){
        console.log('Removing '+svcName+' service.');
        if (!isAdmin){
          if (daemon.user.account !== null && daemon.user.password !== null){
            cmd = "runas /profile /user:"+daemon.user.domain+"\\"+daemon.user.account+" "+rmCmd;
            exec(cmd,uninstalled);
          } else if (daemon.sudo.password !== null){
            // If the user is not an admin, but a sudo password is provided for admin,
            // attempt to remove using sudo.
            wincmd.sudo(rmCmd,daemon.sudo.password||'',uninstalled);
          } else {
            throw PermError;
          }
        } else {
          wincmd.elevate(rmCmd,uninstalled);
        }
      });
    });
  }
};

// Export functionality for the module.
module.exports = daemon;