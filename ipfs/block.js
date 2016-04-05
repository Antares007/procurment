'use strict'
const Hash = require('./src/hash')
const Hashish = require('./src/hashish')

class Block extends Hashish {
  valueOf (ipfs) {
    return this.hash.valueOf(ipfs)
  }

  static of (buffer) {
    return new Block(Hash.hash(buffer))
  }
}

module.exports = Block
