// Handle input parameters
var Logger = require('./eventlog'),
    Args = require('@author.io/arg'),
    net = require('net'),
    max = 60,
    p = require('path'),
    fork = require('child_process').fork,
    attempts = 0,
    startTime = null,
    starts = 0,
    child = null,
    forcekill = false;

Args.configure({
    file: {
        type: 'string',
        required: true,
        alias: 'f',
        description: 'The absolute path of the script to be run as a process.',
        validate: function(value){
            require('fs').existsSync(p.resolve(value),function(exists){
                return exists;
            });
        }
    },
    scriptoptions: {
        type: 'string',
        description: 'The options to be sent to the script.'
    },
    cwd: {
        type: 'string',
        description:  'The absolute path of the current working directory of the script to be run as a process.',
        alias: 'd',
        validate: function(value){
            require('fs').existsSync(p.resolve(value),function(exists){
                return exists;
            });
        }
    },
    log: {
        type: 'string',
        required: true,
        alias: 'l',
        description: 'The descriptive name of the log for the process'
    },
    eventlog: {
        type: 'string',
        alias: 'e',
        description: 'The event log container. This must be APPLICATION or SYSTEM.',
        defaults: 'APPLICATION'
    },
    maxretries: {
        type: 'number',
        alias: 'm',
        description: 'The maximim number of times the process will be auto-restarted.',
        defaults: -1
    },
    maxrestarts: {
        type: 'number',
        alias: 'r',
        description: 'The maximim number of times the process should be restarted within a '+max+' second period shutting down.',
        defaults: 5
    },
    wait: {
        type: 'number',
        alias: 'w',
        description: 'The number of seconds between each restart attempt.',
        defaults: 1,
        validate: function(value){
            return value >= 0;
        }
    },
    grow: {
        type: 'number',
        alias: 'g',
        description: 'A percentage growth rate at which the wait time is increased.',
        defaults: .25,
        validate: function(value){
            return value >= 0 && value <= 1;
        }
    },
    abortonerror: {
        type: 'string',
        alias: 'a',
        description: 'Do not attempt to restart the process if it fails with an error.',
        defaults: 'no',
        options: ['y','n','yes','no']
    },
    stopparentfirst: {
        type: 'string',
        alias: 's',
        decribe:  'Allow the script to exit using a shutdown message.',
        defaults: 'no',
        options: ['y','n','yes','no']
    }
});
Args.disallowUnrecognized();
Args.enforceRules();

var argv = Args.data,
    log = new Logger(argv.eventlog == undefined ? argv.log : {source:argv.log,eventlog:argv.eventlog}),
    script = p.resolve(argv.file),
    wait = argv.wait*1000,
    grow = argv.grow+1;

if (argv.cwd){
  if (!require('fs').existsSync(p.resolve(argv.cwd))){
    console.warn(argv.cwd+' not found.');
    argv.cwd = process.cwd();
  }
  argv.cwd = p.resolve(argv.cwd);
}

if (typeof argv.maxretries === 'string'){
  argv.maxretries = parseInt(argv.maxretries);
}

// Set the absolute path of the file
argv.file = p.resolve(argv.file);

// Hack to force the wrapper process to stay open by launching a ghost socket server
var server = net.createServer().listen();

server.on('error', function (err) {
    launch('warn', err.message);
    server = net.createServer().listen();
});

/**
 * @method monitor
 * Monitor the process to make sure it is running
 */
var monitor = function() {
  if(!child || !child.pid) {

    // If the number of periodic starts exceeds the max, kill the process
    if (starts >= argv.maxrestarts){
      if (new Date().getTime()-(max*1000) <= startTime.getTime()){
        log.error('Too many restarts within the last '+max+' seconds. Please check the script.');
        process.exit();
      }
    }

    setTimeout(function(){
      wait = wait * grow;
      attempts += 1;
      if (attempts > argv.maxretries && argv.maxretries >= 0){
        log.error('Too many restarts. '+argv.file+' will not be restarted because the maximum number of total restarts has been exceeded.');
        process.exit();
      } else {
        launch('warn', 'Restarted ' + wait + ' msecs after unexpected exit; attempts = ' + attempts);
      }
    },wait);
  } else {
    // reset attempts and wait time
    attempts = 0;
    wait = argv.wait * 1000;
  }
};


/**
 * @method launch
 * A method to start a process.
 * logLevel - optional logging level (must be the name of a function the the Logger object)
 * msg - optional msg to log
 */
var launch = function(logLevel, msg) {

  if (forcekill) {
    log.info("Process killed");
    return;
  }

  //log.info('Starting '+argv.file);
  if (logLevel && msg) {
    log[logLevel](msg);
  }

  // Set the start time if it's null
  if (startTime == null) {
    startTime = startTime || new Date();
    setTimeout(function(){
      startTime = null;
      starts = 0;
    },(max*1000)+1);
  }
  starts += 1;

  // Fork the child process
  var opts = {env:process.env};
  var args = [];
  if (argv.cwd) opts.cwd = argv.cwd;
  if (argv.stopparentfirst) opts.detached = true;
  if (argv.scriptoptions) args = argv.scriptoptions.split(' ');
  child = fork(script,args,opts);

  // When the child dies, attempt to restart based on configuration
  child.on('exit',function(code){
    log.warn(argv.file+' stopped running.');

    // If an error is thrown and the process is configured to exit, then kill the parent.
    if (code !== 0 && argv.abortonerror == "yes"){
      log.error(argv.file+' exited with error code '+code);
      process.exit();
      //server.unref();
    } else if (forcekill) {
      process.exit();
    }

    child = null;
    // Monitor the process
    monitor();
  });
};

var killkid = function(){
  forcekill = true;
  if (child) {
    if (argv.stopparentfirst) {
      child.send('shutdown');
    } else {
      child.kill();
    }
  } else {
      log.warn('Attempted to kill an unrecognized process.');
  }
}

process.on('exit', killkid);
process.on("SIGINT", killkid);
process.on("SIGTERM", killkid);

process.on('uncaughtException', function(err) {
    launch('warn', err.message);
});

// Launch the process
launch('info', 'Starting ' + argv.file);
