'use strict'
var Blob = require('./blob')
class Json extends Blob {
  valueOf (git) {
    return super.valueOf(git).then(function (buffer) {
      return JSON.parse(buffer.toString('utf8'))
    })
  }
  static of (array) {
    return Blob.of(new Buffer(JSON.stringify(array), 'utf8')).castTo(Json)
  }
}
module.exports = Json
