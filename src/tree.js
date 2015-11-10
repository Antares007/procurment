'use strict'
var GitObject = require('./gitobject').GitObject
var Blob = require('./blob').Blob

var run = require('gen-run')
var modes = require('js-git/lib/modes')

const emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const nullSha = 'ec747fa47ddb81e9bf2d282011ed32aa4c59f932'

class Tree extends GitObject {
  constructor (hash) {
    super(hash)
  }

  valueOf (git, cb) {
    if (!cb) return this.valueOf.bind(this, git)
    var ctors = { 'blob': Blob, 'tree': Tree }
    var self = this
    run(function * () {
      var hash = yield self.getHash(git)
      var entries = yield git.loadAs('tree', hash)
      var clone = {}
      for (var name of Object.keys(entries)) {
        var e = entries[name]
        var Ctor = ctors[modes.toType(e.mode)]
        clone[name] = new Ctor(e.hash)
      }
      return clone
    }, cb)
  }

  static of (value) {
    return new Tree((git, cb) => run(function * () {
      var entries = (
        yield Object.keys(value).map(name => (cb) => run(function * () {
          var obj = value[name]
          var hash = yield obj.getHash(git)
          var mode = obj instanceof Tree ? modes.tree : modes.file
          return { name, mode, hash }
        }, cb))
      )
      entries = entries.reduce((s, e) => (s[e.name] = { mode: e.mode, hash: e.hash }, s), {})
      return yield git.saveAs('tree', entries)
    }, cb))
  }

  get (Type, path, nullValue) {
    var pathsToGo = path.split('/')
    return this.bind(Type, function find (entries) {
      var name = pathsToGo.shift()
      var entry = entries[name]
      if (entry) {
        if (pathsToGo.length === 0) {
          return entry
        } else {
          if (entry instanceof Tree) {
            return entry.get(Type, pathsToGo.join('/'), nullValue)
          } else {
            throw new Error('not implemented')
          }
        }
      } else {
        if (nullValue) {
          return nullValue
        }
        throw new Error('not found')
      }
    })
  }

  // merge (newTree) {
  //   return this.bind(Tree, function (ot) {
  //     return newTree.bind(Tree, function (nt) {
  //       var patchs = Object.keys(ot)
  //         .reduce(function (s, key) {
  //           var deleted = ot[key]
  //           var added = nt[key]
  //           if (added) {

  //           } else {
  //             // s[key] = { deleted: }
  //           }
  //           var patch = { old: t1[key], new: t2[key] }
  //           if (patch.new) {
  //             if (patch.old.hash !== patch.new.hash) {
  //               patch.state = 'M'
  //               s[key] = patch
  //             }
  //             delete t2[key]
  //           } else {
  //           }
  //           return s
  //         }, {})
  //       patchs = Object.keys(t2)
  //         .reduce(function (s, key) {
  //           s[key] = { state: 'A', new: t2[key] }
  //           return s
  //         }, patchs)

  //       return Tree.of(diff)
  //     })
  //   })
  //   return new Tree(async (git) => {
  //     var patchStream = git.diffTree(await this.getSha(git), await other.getSha(git))
  //       .transform(function (patch, next) {
  //         if (patch.status === 'M') {
  //           this.push({ newMode: patch.newMode, status: 'A', path: 'modified/new/' + patch.path, newSha: patch.newSha })
  //           this.push({ newMode: patch.oldMode, status: 'A', path: 'modified/old/' + patch.path, newSha: patch.oldSha })
  //         } else if (patch.status === 'A') {
  //           this.push({ newMode: patch.newMode, status: 'A', path: 'added/' + patch.path, newSha: patch.newSha })
  //         } else {
  //           this.push({ newMode: patch.oldMode, status: 'A', path: 'deleted/' + patch.path, newSha: patch.oldSha })
  //         }
  //         next()
  //       })
  //     return await git.mkDeepTree(emptyTreeSha, patchStream)
  //   })
  // }

  // rm (other) {
  //   return new Tree(
  //     async (git) => await git.mkDeepTree(
  //       await this.getSha(git),
  //       (await git.lsTree(await other.getSha(git), true))
  //         .map(e => ({ status: 'D', path: e.path }))
  //     )
  //   )
  // }

  // merge (other) {
  //   return new Tree(
  //     async (git) => await git.mkDeepTree(
  //       await this.getSha(git),
  //       (await git.lsTree(await other.getSha(git), true))
  //         .map(e => ({ status: 'A', path: e.path, newSha: e.sha, newMode: e.mode }))
  //     )
  //   )
  // }

  // merge3 (ours, theirs, fn) {
  //   var mkParam = (x) => x
  //     ? (x.mode.indexOf('100') === 0
  //        ? new Blob(x.sha)
  //        : new Tree(x.sha))
  //     : undefined

  //   return new Tree(
  //     async (git) => {
  //       var sha1 = await this.getSha(git)
  //       var sha2 = await ours.getSha(git)
  //       var sha3 = await theirs.getSha(git)
  //       debug('merged')
  //       debug(await git.lsTree(sha1))
  //       debug(await git.lsTree(sha2))
  //       debug(await git.lsTree(sha3))
  //       var rezSha = await git.merge3(
  //         sha1,
  //         sha2,
  //         sha3,
  //         async function (base, ours, theirs) {
  //           if ([base, ours, theirs].filter(x => !!x).length > 1) {
  //             debug(JSON.stringify({ base, ours, theirs }, null, '  '))
  //           }
  //           var merged = fn(mkParam(base), mkParam(ours), mkParam(theirs))
  //           if (merged === null) {
  //             return {
  //               status: 'D'
  //             }
  //           } else {
  //             return {
  //               mode: merged instanceof Blob ? '100644' : '040000',
  //               sha: await merged.getSha(git)
  //             }
  //           }
  //         }
  //       )
  //       debug(await git.lsTree(rezSha))
  //       return rezSha
  //     }
  //   )
  // }

  // diff (other) {
  //   return new Tree(async (git) => {
  //     var patchStream = git.diffTree(await this.getSha(git), await other.getSha(git))
  //       .transform(function (patch, next) {
  //         if (patch.status === 'M') {
  //           this.push({ newMode: patch.newMode, status: 'A', path: 'modified/new/' + patch.path, newSha: patch.newSha })
  //           this.push({ newMode: patch.oldMode, status: 'A', path: 'modified/old/' + patch.path, newSha: patch.oldSha })
  //         } else if (patch.status === 'A') {
  //           this.push({ newMode: patch.newMode, status: 'A', path: 'added/' + patch.path, newSha: patch.newSha })
  //         } else {
  //           this.push({ newMode: patch.oldMode, status: 'A', path: 'deleted/' + patch.path, newSha: patch.oldSha })
  //         }
  //         next()
  //       })
  //     return await git.mkDeepTree(emptyTreeSha, patchStream)
  //   })
  // }

  // reindex (fn) {
  //   var crypto = require('crypto')
  //   var hash = (str) => crypto.createHash('sha1').update(str).digest('hex')
  //   return new Tree(async (git) => {
  //     var ls = await git.lsTree(await this.getSha(git), true)
  //     var entries = ls.map(function (e) {
  //       var uniqKey = hash(e.path)
  //       var newPath = fn(e.path, uniqKey)
  //       if (newPath) {
  //         if (newPath.indexOf(uniqKey) === -1 && newPath.indexOf(e.path) === -1) {
  //           throw new Error('when reindexing new path should contain old path or hash(path)')
  //         }
  //         e.path = newPath
  //         return e
  //       }
  //     }).filter(function (e) {
  //       return e
  //     })
  //     return await git.mkDeepTree(emptyTreeSha, entries)
  //   })
  // }

  // reduce (fn, initState) {
  //   ensure(() => typeof fn === 'function')
  //   ensure(() => initState instanceof GitObject)
  //   var Ctor = initState.constructor
  //   return new Ctor(async git => {
  //     var ls = await git.lsTree(await this.getSha(git), true)
  //     return await initState.bind(function (initState) {
  //       return ls.reduce(
  //         (state, e) => fn(state, new Blob(e.sha), e.path),
  //         initState
  //       )
  //     }).getSha(git)
  //   })
  // }

  // mapBlobs (fn) {
  //   return new Tree(async (git) => {
  //     var patchStream = git.diffTree(emptyTreeSha, await this.getSha(git))
  //       .transform(async function (patch) {
  //         var object = fn(new Blob(patch.newSha), patch.path)
  //         if (!object) return
  //         ensure(() => object instanceof GitObject)
  //         var sha = await object.getSha(git)
  //         if (sha === nullSha) return

  //         if (object instanceof Tree) {
  //           for (var entry of await git.lsTree(sha, true)) {
  //             this.push({
  //               newMode: entry.mode,
  //               status: 'A',
  //               path: patch.path + '/' + entry.path,
  //               newSha: entry.sha
  //             })
  //           }
  //         } else {
  //           patch.newSha = sha
  //           this.push(patch)
  //         }
  //       })
  //     return await git.mkDeepTree(emptyTreeSha, patchStream)
  //   })
  // }

  // filter (fn) {
  //   return new Tree(async (git) => {
  //     var patchStream = git.diffTree(emptyTreeSha, await this.getSha(git))
  //       .transform(async function (patch) {
  //         var object = fn(new Blob(patch.newSha), patch.path)
  //         var rez = object instanceof Blob
  //           ? JSON.parse((await git.cat(await object.getSha(git))).toString())
  //           : object
  //         if (rez) this.push(patch)
  //       })
  //     return await git.mkDeepTree(emptyTreeSha, patchStream)
  //   })
  // }

}
Tree.empty = new Tree(emptyTreeSha)
Tree.emptySha = emptyTreeSha

function ensure (assertFn) {
  if (!assertFn()) throw new Error(assertFn.toString())
}

module.exports = { Tree }
