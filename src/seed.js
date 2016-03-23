'use strict'
// var Tree = require('./src/tree')
var Blob = require('./src/blob')
// var Commit = require('./src/commit')

class Seed extends Blob {
  valueOf (git) {
    return super.valueOf(git).then(function (buff) {
      // return parseFunction(buff.toString())
    })
  }

  static of (fn) {
    return new Seed(
      (git) => Blob.of(new Buffer(fn.toString())).getHash(git)
    )
  }
}
module.exports = Seed
