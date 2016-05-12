'use strict'
var Blob = require('./blob')
class Json extends Blob {
  valueOf (repo) {
    return super.valueOf(repo).then(function (buffer) {
      return JSON.parse(buffer.toString('utf8'))
    })
  }
  static of (array) {
    return Blob.of(new Buffer(JSON.stringify(array, null, '  '), 'utf8')).castTo(Json)
  }
}
module.exports = Json
