var exec = require('child_process').exec,
    path = require('path'),
    fs = require('fs'),
    PermError = 'Permission Denied. Requires administrative privileges.',
    wincmd = require('./binaries'),
    Logger = require('./eventlog'),
    daemonDir = 'daemon';

// BEGIN SUPER AWFUL HACK TO GET AROUND WINSW.EXE ISSUE! REPLACE ASAP!!!!
// winsw.exe immediately responds with nothing, indicating success, even though
// it continues processing with the "install" method.
var sleep = function(period){
  var st = new Date().getTime();
  while(new Date().getTime() <= st+(period*1000)){}
  return;
};

// The daemon class
var daemon = function(config){

  Object.defineProperties(this,{
    _name: {
      enumerable: false,
      writable: true,
      configurable: false,
      value: config.name || null
    },

    _eventlog:{
      enumerable: false,
      writable: true,
      configurable: false,
      value: null
    },

    _xml: {
      enumerable: false,
      get: function(){
        return require('./winsw').generateXml({
          name: this.name,
          id: this.id,
          script: this.script,
          description: this.description,
          logpath: this.logpath
        });
      }
    },

    _exe: {
      enumerable: false,
      get: function(){
        return this.id+'.exe';
      }
    },

    _directory: {
      enumerable: false,
      writable: true,
      configurable: false,
      value: this.script !== null ? path.dirname(this.script) : null
    },

    /**
     * Resolves the directory where the script is saved.
     */
    directory: {
      enumerable: false,
      writable: false,
      configurable: false,
      value: function(dir){
        if (this.script == null || this.name == null){
          throw Error('Script and Name are required but were not provided.');
        }
        if (dir){
          this._directory = path.resolve(dir||'./');
        }
        return path.resolve(path.join(this._directory,daemonDir));
      }
    },

    /**
     * @property {String} root
     * The root directory where the process files are stored.
     */
    root: {
      enumerable: true,
      get: function(){ return this.directory();}
    },

    // Generates the primary logging utility
    log: {
      enumerable: false,
      get: function(){
        if (this._eventlog !== null)
          return this._eventlog;
        if (this.name == null)
          throw 'No name was specified for the service';
        this._eventlog = new Logger(this.name+' Monitor');
        return this._eventlog;
      }
    },

    // The path where log files should be stored
    logpath: {
      enumerable: true,
      writable: false,
      configurable: false,
      value: config.logpath || null
    },

    // The log mode. Options are the same as winsw#generateXml
    logmode: {
      enumerable: true,
      writable: false,
      configurable: false,
      value: config.logmode || 'rotate'
    },

    // The name of the process
    name: {
      enumerable: false,
      get: function(){return this._name;},
      set: function(value){this._name = value;}
    },

    // The ID for the process
    id: {
      enumerable: true,
      get: function(){
        return this.name.replace(/[^\w]/gi,'').toLowerCase();
      }
    },

    // Description of the service
    description: {
      enumerable: true,
      writable: false,
      configurable: false,
      value: config.description || ''
    },

    // Optionally define a user and domain. By default, the domain is the local machine name.
    user: {
      enumerable: false,
      writable: true,
      configurable: false,
      value: {
        account: null,
        password: null,
        domain: process.env.COMPUTERNAME
      }
    },

    // Optionally provide a sudo password.
    sudo: {
      enumerable:false,
      writable: true,
      configurable: false,
      value: {
        password: null
      }
    },

    /**
     * @cfg {String} script
     * The absolute path of the script to launch as a service.
     * @required
     */
    script: {
      enumerable: true,
      writable: true,
      configurable: false,
      value: config.script !== undefined ? require('path').resolve(config.script) : null
    },

    /**
     * @method install
     * Install the script as a process.
     * @param {String} [dir=root of script]
     * The directory where the process files will be saved. Defaults to #script path.
     * @param {Function} [callback]
     * The callback to fire when the installation completes.
     */
    /**
     * @event install
     * Fired when the installation process is complete.
     */
    install: {
      enumerable: true,
      writable: false,
      configurable: false,
      value: function(dir){
        if (this.script == null || this.name == null){
          throw Error('Script and Name are required but were not provided.');
        }

        if (this.exists){
          this.log.warn('The process cannot be installed because it already exists.');
          return;
        }

        var winsw = require('./winsw'), me = this;

        if (typeof dir === 'function'){
          callback = dir;
          dir = null;
        }
        dir = this.directory(dir);

        // If the output directory does not exist, create it.
        fs.exists(dir,function(exists){
          if (!exists){
            fs.mkdirSync(dir);
          }
          // Write the configuration file
          fs.writeFile(path.resolve(dir,me.id+'.xml'),me._xml,function(){
            // Write the exe file
            winsw.createExe(me.id,dir,function(){
              me.execute('"'+path.resolve(dir,me._exe)+'" install',function(){
                console.log('Supposedly started using '+'"'+path.resolve(dir,me._exe)+'" install',arguments);
                sleep(1);
                me.emit('install');
              });
            });
          });
        });
      }
    },

    /**
     * @method uninstall
     * Uninstall the service.
     */
    /**
     * @event uninstall
     * Fired when the uninstall is complete.
     */
    uninstall: {
      enumerable: true,
      writable: false,
      value: function(){
        var me = this;

        if (!this.exists){
          console.log('Uninstall was skipped because process does not exist or could not be found.');
          return;
        }

        var uninstaller = function(){
          // Uninstall the process
          me.execute('"'+path.resolve(me.root,me._exe)+'" uninstall',function(error,stdout,stderr){
            if (error){
              me.checkPermError(error);
            } else if (stderr.trim().length > 0){
              console.log('Error: ',stderr);
              me.log.error(stderr);
            } else {
              sleep(1.5);

              var rm = function(file){
                if (fs.existsSync(path.join(me.root,file))){
                  fs.unlinkSync(path.join(me.root,file));
                  callback && callback();
                }
              };

              // Remove the daemon files individually to prevent security warnings.
              rm(me.id+'.xml');
              rm(me.id+'.err.log');
              rm(me.id+'.wrapper.log');
              rm(me.id+'.out.log');
              rm(me.id+'.exe');

              if (me.root !== path.dirname(me.script)){
                me.execute("rmdir \""+me.root+"\" /s /q",function(){
                  me.emit('uninstall');
                });
              } else {
                me.emit('uninstall');
              }
            }
          });
        };

        this.once('stop',function(){
          uninstaller();
        });
        this.once('alreadystopped',function(){
          uninstaller();
        });
        this.stop();
      }
    },

    /**
     * @method start
     * Start an existing method.
     */
    /**
     * @event start
     * Fired when the event has started.
     */
    start: {
      enumerable: true,
      writable: false,
      configurable: false,
      value: function(){
        var me = this;

        if (this.name == null){
          throw "A name for the service is required.";
        }

        if (!this.exists){
          throw Error('The service "'+this.name+'" does not exist or could not be found.');
        }

        this.execute('NET START '+me.id,function(err,stdout,stderr){
          if (err){
            if (err.code == 2){
              if (err.message.indexOf('already been started') >= 0 && err.message.indexOf('service name is invalid') < 0){
                me.log.warn('An attempt to start the service failed because the service is already running. The process should be stopped before starting, or the restart method should be used.');
                me.emit('error',err);
                return;
              } else if (err.message.indexOf('service name is invalid') < 0){
                me.checkPermError(err);
                console.log(err);
                me.emit('error',err);
                return;
              }
            } else {
              me.log.error(err.toString());
            }
          } else {
            me.emit('start');
          }
        })
      }
    },

    /**
     * @method stop
     * Stop the service.
     */
    /**
     * @event stop
     * Fired when the service is stopped.
     */
    stop: {
      enumerable: true,
      writable: false,
      value: function(){
        var me = this;

        me.execute('NET STOP '+me.id,function(err,stdout,stderr){
          if (err){
            if (err.code == 2){
              me.log.warn('An attempt to stop the service failed because the service is/was not running.');
              callback(err);
              me.emit('alreadystopped');
            } else {
              me.checkPermError(err);
            }
          } else {
            me.emit('stop');
          }
        });
      }
    },

    /**
     * @method restart
     * Restart an existing service
     */
    restart: {
      enumerable: true,
      writable: false,
      value: function(callback){
        var me = this;
        this.once('stop',me.start);
        this.stop();
      }
    },

    /**
     * @property {Boolean} exists
     * Determine whether the service exists.
     */
    exists: {
      enumerable: true,
      get: function(){
        if (this.script == null || this.name == null){
          throw Error('Script and name are required but were not specified.');
        }
        return fs.existsSync(this.directory(),this.id+'.exe') && fs.existsSync(this.directory(),this.id+'.xml') ;
      }
    },

    // Execute commands with elevated privileges.
    execute: {
      enumerable: false,
      writable: false,
      configurable: false,
      value: function(cmd,options,callback) {
        var me = this;
        callback = callback || function(){};
        options = options || {};

        wincmd.isAdminUser(function(isAdmin){
          if (isAdmin) {
            if (typeof options === 'function'){
              callback = options;
              options = {};
            }
            if (me.user.account !== null && me.user.password !== null){
              _cmd = "runas /profile /user:"+me.user.domain+"\\"+me.user.account+" "+cmd;
              exec(cmd,options,callback);
            } else if (me.sudo.password !== null){
              // If the user is not an admin, but a sudo password is provided for admin,
              // attempt to launch using sudo.
              wincmd.sudo(cmd,me.sudo.password||'',options,callback);
            } else {
              wincmd.elevate(cmd,options,callback)
            }
          } else {
            console.log(PermError);
            throw PermError;
          }
        });
      }
    },

    // Check for permission errors
    checkPermError: {
      enumerable: false,
      writable: false,
      configurable: false,
      value: function(error){
        if (error.message.indexOf('Administrator access') >= 0 || error.message.indexOf('Access is denied') >= 0){
          try {this.log.error(PermError);} catch(e){console.log(PermError);}
        } else {
          try {this.log.error(error.toString());} catch(e) {console.log(error.toString());}
        }
        process.exit(1);
      }
    }
  });
};

var util = require('util'),
    EventEmitter = require('events').EventEmitter;

// Inherit Events
util.inherits(daemon,EventEmitter);

// Export functionality for the module.
module.exports = daemon;