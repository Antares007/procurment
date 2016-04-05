'use strict'
const Hashish = require('./src/hashish')
const encode = require('./encode')
const Block = require('./block')
var assert = require('assert')

class DNode extends Block {
  valueOf (ipfs) {
    return this.hash.cast(Block).valueOf(ipfs).then(function (buffer) {
      var rez = encode.decode(buffer)
      rez.Links = rez.Links.map((l) => (l.Hash = new DNode(() => Promise.resolve(l.Hash)), l))
      return rez
    })
  }

  size (ipfs) {
    return this.valueOf(ipfs).then(function (v) {
      return encode.encode(v).length + v.Links.reduce((s, l) => s + l.Tsize, 0)
    })
  }

  static of (value) {
    assert.ok(Buffer.isBuffer(value.Data))
    return new DNode(function (ipfs) {
      var linkPromises = (value.Links || []).map(function (link) {
        return link.Hash.getHash(ipfs).then(function (hash) {
          return link.Hash.size(ipfs).then(function (size) {
            return { Name: link.Name, Tsize: size, Hash: hash }
          })
        })
      })
      return Promise.all(linkPromises).then(function (links) {
        var obj = {
          Links: links,
          Data: value.Data
        }
        var rez = encode.encode(obj)
        console.log(rez)
        return Block.of(rez).getHash(ipfs)
      })
    })
  }
}
module.exports = DNode
