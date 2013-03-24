var Service = require('../').Service;

// Create a new service object
var svc = new Service({
  name:'Hello World',
  script: require('path').join(__dirname,'helloworld.js')
});

// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall',function(){
  console.log('Uninstall complete.');
  console.log('The service exists: ',svc.exists);
});

// Uninstall the service.
svc.uninstall();