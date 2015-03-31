#!/usr/bin/env iojs
require('babel/register')({
  whitelist: [
    'asyncToGenerator',
    'es6'
  ]
});
var argv = require('yargs')
  .usage('Usage: $0 -user [userName] -pass [password]')
  .demand(['user','pass'])
  .argv;

var stream = require('stream');
var request = require('request');

if(argv._.length !== 1) {
  console.log('add module name as argument');
  return;
}
var j = request.jar();
request = request.defaults({jar: j});

var headers = {
  'Connection': 'keep-alive',
  'Cache-Control': 'max-age=0',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.94 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.8,ka;q=0.6,de;q=0.4,ru;q=0.2'
};

var session = {
  postForm: function(url, form, cb) {
    request.post({
      url : url,
      form: form,
      headers: headers
    }, function(error, response, body) {
      if(error || response.statusCode !== 200) {
        return cb(error || response.statusCode);
      }
      cb(null, body);
    });
  },
  get: function(url, cb) {
    request.get({
      url : url,
      headers: headers
    }, function(error, response, body) {
      if(error || response.statusCode !== 200) {
        return cb(error || response.statusCode);
      }
      cb(null, body);
    });
  },
  stream: function(url, nextUrl, parser) {
    var get = this.get;
    var currentUrl = url;
    return new stream.Readable({
      objectMode: true,
      read: function(n) {
        var ds = this;
        get(currentUrl, function(err, body) {
          if(err) {
            ds.emit('error', err);
          }
          currentUrl = nextUrl(currentUrl, body);
          ds.push(parser(body));
        });
      }
    });
  }
};

request.post({
  url : 'https://tenders.procurement.gov.ge/login.php',
  form: {user:argv.user, pass:argv.pass, lang: 'ge'},
  headers: headers
}, function(error, response, body) {
  if(error || response.statusCode !== 302) {
    throw error || response.statusCode;
  }
  session.get('https://tenders.procurement.gov.ge', function(err) {
    if(err) { 
      throw err;
    }  
    var module = require(argv._[0]);
    module(session);
  });
});
