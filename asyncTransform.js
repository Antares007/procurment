var stream = require('stream');
var transform = require('./parallel-transform.js');

var asyncTransform = function(fn){
  return transform(4, function(chunk, next){
    var ds = this;
    fn(chunk).then(function(rez){
      ds.push(rez);
      next();
    }).catch(function(err){
      process.nextTick(function(){
        ds.emit('error', err);
      });
    });
  });
};

module.exports = asyncTransform;
