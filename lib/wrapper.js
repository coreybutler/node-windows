// Handle input parameters
var Logger = require('./eventlog'),
    optimist = require('optimist'),
    max = 60,
    p = require('path'),
    argv = optimist
      .demand('file')
      .alias('f','file')
      .describe('file','The absolute path of the script to be run as a process.')
      .check(function(argv){
        require('fs').existsSync(p.resolve(argv.f),function(exists){
          return exists;
        });
      })
      .alias('d','cwd')
      .describe('cwd','The absolute path of the current working directory of the script to be run as a process.')
//      .check(function(argv){
//        require('fs').existsSync(p.resolve(argv.d),function(exists){
//          return exists;
//        });
//      })
      .demand('log')
      .alias('l','log')
      .describe('log','The descriptive name of the log for the process')
      .default('eventlog','APPLICATION')
      .alias('e','eventlog')
      .describe('eventlog','The event log container. This must be APPLICATION or SYSTEM.')
      .default('maxretries',-1)
      .alias('m','maxretries')
      .describe('maxretries','The maximim number of times the process will be auto-restarted.')
      .default('maxrestarts',5)
      .alias('r','maxrestarts')
      .describe('maxrestarts','The maximim number of times the process should be restarted within a '+max+' second period shutting down.')
      .default('wait',1)
      .alias('w','wait')
      .describe('wait','The number of seconds between each restart attempt.')
      .check(function(argv){
        return argv.w >= 0;
      })
      .default('grow',.25)
      .alias('g','grow')
      .describe('grow','A percentage growth rate at which the wait time is increased.')
      .check(function(argv){
        return (argv.g >= 0 && argv.g <= 1);
      })
      .default('abortonerror','no')
      .alias('a','abortonerror')
      .describe('abortonerror','Do not attempt to restart the process if it fails with an error,')
      .check(function(argv){
        return ['y','n','yes','no'].indexOf(argv.a.trim().toLowerCase()) >= 0;
      })
      .argv,
    log = new Logger(argv.e == undefined ? argv.l : {source:argv.l,eventlog:argv.e}),
    fork = require('child_process').fork,
    script = p.resolve(argv.f),
    wait = argv.w*1000,
    grow = argv.g+1,
    attempts = 0,
    startTime = null,
    starts = 0,
    child = null
    forcekill = false;

if (argv.d){
  if (!require('fs').existsSync(p.resolve(argv.d))){
    console.warn(argv.d+' not found.');
    argv.d = process.cwd();
  }
}

if (typeof argv.m === 'string'){
  argv.m = parseInt(argv.m);
}

// Set the absolute path of the file
argv.f = p.resolve(argv.f);

// Hack to force the wrapper process to stay open by launching a ghost socket server
var server = require('net').createServer().listen();

/**
 * @method monitor
 * Monitor the process to make sure it is running
 */
var monitor = function(exit){
  if(!child.pid||exit){

    // If the number of periodic starts exceeds the max, kill the process
    if (starts >= argv.r){
      if (new Date().getTime()-(max*1000) <= startTime.getTime()){
        log.error('Too many restarts within the last '+max+' seconds. Please check the script.');
        process.exit();
      }
    }

    setTimeout(function(){
      wait = wait * grow;
      attempts += 1;
      if (attempts > argv.m && argv.m >= 0){
        log.error('Too many restarts. '+argv.f+' will not be restarted because the maximum number of total restarts has been exceeded.');
        process.exit();
      } else {
        launch();
      }
    },wait);
  } else {
    attempts = 0;
    wait = argv.w * 1000;
  }
};


/**
 * @method launch
 * A method to start a process.
 */
var launch = function(){

  if (forcekill){
    return;
  }

  log.info('Starting '+argv.f);

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
  if (argv.d) opts.cwd = argv.d;
  child = fork(script,opts);

  // When the child dies, attempt to restart based on configuration
  child.on('exit',function(code){
    log.warn(argv.f+' stopped running.');

    // If an error is thrown and the process is configured to exit, then kill the parent.
    if (code !== 0 && argv.a == "yes"){
      log.error(argv.f+' exited with error code '+code);
      process.exit();
      //server.unref();
    }

    // Monitor the process
    monitor(true);
  });
};

var killkid = function(){
  forcekill = true;
  child.kill();
  /*if (child.pid) {
    require('child_process').exec('taskkill /F /PID '+child.pid,function(){
      process.exit(0);
    });
  }*/
}

process.on('exit',killkid);
process.on("SIGINT", killkid);
process.on("SIGTERM", killkid);

// Launch the process
launch();
