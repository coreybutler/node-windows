var http = require('http');
var server = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  //res.end(JSON.stringify(process.env));
  res.end('Hello World\n');
});

server.listen(3000, '127.0.0.1');
console.log('Server running at http://127.0.0.1:3000/');

// Force the process to close after 15 seconds
/*setTimeout(function(){
  process.exit();
},15000);
*/