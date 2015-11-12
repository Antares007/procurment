'use strict'
var ref = 'refs/heads/master'
var repoPath = require('path').resolve(__dirname, '../Anvol/.git')

var repo = {}
repo.rootPath = repoPath
require('js-git/mixins/fs-db')(repo, require('./mac-fs.js'))
require('js-git/mixins/read-combiner')(repo)
var prepo = [
  'saveAs',
  'loadAs',
  'readRef'
].reduce((s, n) => (s[n] = toPromise(repo[n].bind(repo)), s), {})

var Tree = require('./src/tree')
var Blob = require('./src/blob')
var Commit = require('./src/commit')

class Json extends Blob {
  constructor (hash) {
    super(hash)
  }

  valueOf (git) {
    return super.valueOf(git).then(function (buff) {
      return JSON.parse(buff.toString())
    })
  }

  static of (object) {
    return new Json(
      (git) => Blob.of(new Buffer(JSON.stringify(object))).getHash(git)
    )
  }

  cast (value) {
    switch (value.constructor) {
      case Tree:
        return new Json(
          git => value.valueOf(git).then(function (tree) {
            return Json.of(tree).getHash(git)
          })
        )
      default:
        throw new TypeError('cant cast')
    }
  }
}
prepo.readRef(ref).then(function (hash) {
  return new Commit(hash).bind(Tree, function (commit) {
    return commit.tree
  }).get(Json, 'invoisebi/PakingLists')
    .valueOf(prepo)
}).then(console.log.bind(console))
  .catch(console.log.bind(console))


// var c = Commit.of({
//   tree: Tree.of({
//     a: Blob.of(new Buffer('a'))
//   }),
//   author: {
//     name: 'Archil Bolkvadze',
//     email: 'a.bolkvadze@gmail.com',
//     date: { seconds: 1446842087, offset: -240 }
//   },
//   committer: {
//     name: 'Archil Bolkvadze',
//     email: 'a.bolkvadze@gmail.com',
//     date: { seconds: 1446842087, offset: -240 }
//   },
//   message: 'refine api\n'
// })
// c.bind(Commit, function (commit) {
//   commit.parents = [ c ]
//   return Commit.of(commit)
// }).valueOf(prepo)
//   .then(console.log.bind(console))
//   .catch(console.log.bind(console))

function toPromise (fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments)
    return new Promise((resolve, reject) => {
      fn.apply(this, args.concat(function (err, value) {
        if (err) {
          reject(err)
        } else {
          resolve(value)
        }
      }))
    })
  }
}
