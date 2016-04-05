'use strict'
// const mDAG = require('ipfs-merkle-dag')
// const UnixFS = require('ipfs-unixfs')
const ipfsAPI = require('ipfs-api')
const ipfs = ipfsAPI('/ip4/127.0.0.1/tcp/5001')

const Hash = require('./src/hash')
const Block = require('./block')

Hash.bs58('QmVyGunz6bwTM1Y6rnLLHowXrEji5WLoU7DhRaoULv2btn')
  .castTo(Block)
  .bind(Block, function (v) {
    return Block.of(v)
  })
  .hash.toBs58(ipfs)
  .then(console.log.bind(console))
  .catch((err) => console.log(err.stack))

return
const DNode = require('./dnode')

var node0 = DNode.of({ Links: [], Data: new Buffer('\x33\x33\x33') })
// var node = DNode.of({ links: [ { name: 'acd', node: node0 } ], data: new Buffer('\x11\x11\x11') })

node0
  .bind(DNode, function (v) {
    console.log('aaaaaaaaaaa', v)
    return DNode.of(v)
  })
  .getHash(ipfs)
  .then(console.log.bind(console))
  .catch((err) => console.log(err.stack))

return

new Block((ipfs) => node.getHash(ipfs))
  .bind(Block, function (v) {
    console.log(v.toString('binary'))
    console.log(encode.decode(v))
    return v
  })
  .getHash(ipfs)
  .then(console.log.bind(console))
  .catch(console.log.bind(console))

return
var blockforDagDir = new Block((ipfs) => Promise.resolve('QmbECxy6b8QEAjkWgz51ScaHL2zTuYDi4Ls6NLz9ME36mD'))
  .bind(Block, (buff) => Block.of(buff))
  .getHash(ipfs)
  .then(console.log.bind(console))
  .catch(console.log.bind(console))

return
var Hashish = require('./src/hashish')
var UnixFS = require('ipfs-unixfs')
var node = new DNode((ipfs) => Promise.resolve('QmTKZgRNwDNZwHtJSjCp6r5FYefzpULfy37JvMt9DwvXse'))
class DagFile extends DNode {
  valueOf (ipfs) {
    return super.valueOf(ipfs).then(function (value) {
      return UnixFS.unmarshal(value.data).data
    })
  }

  size (ipfs) {
    return this.valueOf(ipfs).then(function (buff) {
      return buff.length
    })
  }

  static of (buff) {
    return new DagFile(
      (ipfs) => DNode.of({
        links: [],
        data: new UnixFS('file', buff).marshal()
      }).getHash(ipfs)
    )
  }
}

class DagDir extends DNode {
  size (ipfs) {
    return this.valueOf(ipfs).then(function (dir) {
      return Promise.all(
        Object.keys(dir)
          .filter((name) => dir[name] instanceof DagFile)
          .map((name) => dir[name].size(ipfs))
      ).then((sizes) => sizes.reduce((s, x) => s + x, 0))
    })
  }

  valueOf (ipfs) {
    var decodeType = function (data) {
      var t = UnixFS.unmarshal(data).type
      if (t === 'file') return DagFile
      if (t === 'directory') return DagDir
      throw new Error(`type [${t}] not impl`)
    }

    var enrichLinksWithFsTypes = (links) => Promise.all(
      links.map(
        (l) => l.node.valueOf(ipfs).then((v) => (l.Type = decodeType(v.data), l))
      )
    )

    return super.valueOf(ipfs).then(function (value) {
      if (UnixFS.unmarshal(value.data).type !== 'directory') throw new Error('not a directory')
      return enrichLinksWithFsTypes(value.links).then(function (linksWithTypes) {
        return value.links.reduce(
          (s, l) => (s[l.name] = new l.Type(() => Promise.resolve(l.hash)), s),
          {}
        )
      })
    })
  }

  static of (value) {
    return new DagDir(
      (ipfs) => DNode.of({
        links: Object.keys(value).map((name) => ({ name, node: value[name] })),
        data: new UnixFS('directory').marshal()
      }).getHash(ipfs)
    )
  }
}

// DNode.of({
//   links: [],
//   data: new Buffer('asjkjljkjlj')
// })
var node = new DagDir(() => Promise.resolve('QmbECxy6b8QEAjkWgz51ScaHL2zTuYDi4Ls6NLz9ME36mD'))

node = node
  .bind(DagDir, (d) => DagDir.of(d))
  // .bind(DagDir, (n) => n['flie name']
  //                         .bind(DagDir, (buff) => DagDir.of({
  //                           'flie name': DagFile.of(buff),
  //                           folder: DagDir.of(n)
  //                         }))
  //      )

node
  .getHash(ipfs)
  .then(console.log.bind(console))
  .catch(console.log.bind(console))

//
// var file = new UnixFS('file', new Buffer('Arakela'))

// ipfs.object.put(new Buffer(JSON.stringify({Data: file.marshal().toString()})))
//   .then(console.log.bind(console))
//   .catch(console.log.bind(console))

// var dirUnixFS = new UnixFS('directory')

// ipfs.object.put(new Buffer(JSON.stringify({Data: dirUnixFS.marshal().toString()})))
//   .then(console.log.bind(console))
//   .catch(console.log.bind(console))
