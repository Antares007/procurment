var stream = require('stream');

var asyncTransform = function(fn){
  return new require('stream').Transform({
    objectMode: true,
    transform: function(chunk, _, next){
      var ds = this;
      fn(chunk).then(function(rez){
        ds.push(rez);
        next();
      }).catch(function(err){
        process.nextTick(function(){
          ds.emit('error', err);
        })
      });
    }
  })
};

module.exports = asyncTransform;
