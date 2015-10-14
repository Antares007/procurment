var stream = require('stream');

var transform = function(fn, flushFn){
  return new require('stream').Transform({
    objectMode: true,
    transform: function(chunk, _, next){
      fn.call(this, chunk, next);
    },
    flush: flushFn
  })
};

module.exports = transform;
