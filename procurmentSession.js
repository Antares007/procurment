var debug = require('debug')('procurmentSession');
var retry = require('retry');

module.exports = function openSession(options, cb) {
  var replay = require('request-replay');
  var request = require('request')
  request = request.defaults({
    jar: request.jar(),
    headers: {
      'Connection': 'keep-alive',
      'Cache-Control': 'max-age=0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.94 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.8,ka;q=0.6,de;q=0.4,ru;q=0.2'
    }
  });

  var get = function(url, cb) {
    replay(request.get({
      url : url
    }, function(error, response, body) {
      if(error || response.statusCode !== 200) {
        cb(new Error(error || response.body));
      } else {
        cb(null, body);
      }
    })).on('replay', function (replay) {
      debug('request failed: ' + replay.error.code + ' ' + replay.error.message);
      debug('replay nr: #' + replay.number);
      debug('will retry in: ' + replay.delay + 'ms')
    });
  };

  request.post({
    url : 'https://tenders.procurement.gov.ge/login.php',
    form: {user:options.user, pass:options.pass, lang: 'ge'}
  }, function(error, response, body) {
    if(error || response.statusCode !== 302) {
      throw error || response.statusCode;
    }
    get('https://tenders.procurement.gov.ge', function(err, _) {
      if(err) {
        cb(err);
      } else {
        cb(null, function(url, cb){
          var operation = retry.operation();
          operation.attempt(function(currentAttempt) {
            get(url, function(err, body) {
              if (operation.retry(err)) {
                return;
              }
              cb(err ? operation.mainError() : null, body);
            });
          });
        });
      }
    });
  });
};
