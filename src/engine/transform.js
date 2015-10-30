export default function (fn, flushFn) {
  var stream = require('stream')
  return new stream.Transform({
    objectMode: true,
    transform: function (chunk, _, next) {
      fn.call(this, chunk, next)
    },
    flush: flushFn
  })
}
