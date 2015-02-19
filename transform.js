var stream = require('stream');

var transform = function(cb) {
  return new stream.Transform({
    objectMode: true,
    transform: function(chunk, encoding, next) {
      cb.call(this, chunk, next);
    },
    flush: function(done) {
      done();
    }
  });
};

module.exports = transform;
