'use strict'
var Hashish = require('./hashish')

class GitObject extends Hashish {
  valueOf (repo) {
    return super.valueOf(repo).then(function (buffer) {
      var space = buffer.indexOf(0x20)
      if (space < 0) throw new Error('Invalid git object buffer')
      var nil = buffer.indexOf(0x00, space)
      if (nil < 0) throw new Error('Invalid git object buffer')
      var body = buffer.slice(nil + 1)
      var size = parseDec(buffer, space + 1, nil)
      if (size !== body.length) throw new Error('Invalid body length.')
      var type = buffer.slice(0, space).toString('binary')
      return { type: type, body: body }
    })
  }

  static of (obj) {
    if (!obj) throw new Error('not git object')
    if (typeof obj.type !== 'string') throw new Error('not git object')
    if (!Buffer.isBuffer(obj.body)) throw new Error('not git object')
    return Hashish.of(
      Buffer.concat([
        new Buffer(obj.type + ' ' + obj.body.length + '\0', 'binary'),
        obj.body
      ])
    ).castTo(GitObject)
  }
}
module.exports = GitObject

function parseDec (buffer, start, end) {
  var val = 0
  while (start < end) {
    val = val * 10 + buffer[start++] - 0x30
  }
  return val
}
