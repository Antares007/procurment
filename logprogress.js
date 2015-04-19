var transform = require('./transform.js');

module.exports = function logProgress(step, fn){
  var debug = require('debug')('progress');
  var i = 0;
  var lastx;
  fn = fn || function() {
    return i;
  };
  return transform(function(x, next){
    i++;
    if(i % step === 0){
      debug(fn(x, i));
    }
    lastx = x;
    this.push(x);
    next();
  }, function(done){
    if(i % step !== 0){
      debug(fn(lastx, i));
    }
    done();
  });
}

