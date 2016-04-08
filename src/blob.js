'use strict'
var Hashish = require('./hashish')
var codec = require('js-git/lib/object-codec')

class Blob extends Hashish {
  valueOf (api) {
    return super.valueOf(api).then(function (buff) {
      var raw = codec.deframe(buff)
      if (raw.type !== 'blob') throw new Error('not blob')
      return raw.body
    })
  }

  static of (buffer) {
    var raw = codec.frame({
      type: 'blob',
      body: codec.encoders['blob'](buffer)
    })
    return Hashish.of(raw).castTo(Blob)
  }
}
module.exports = Blob
