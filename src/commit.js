'use strict'
var GitObject = require('./gitobject').GitObject
var Tree = require('./tree').Tree
var Blob = require('./blob').Blob
var run = require('gen-run')

class Commit extends GitObject {
  constructor (hash) {
    super(hash)
  }

  valueOf (git, cb) {
    if (!cb) return this.valueOf.bind(this, git)
    var self = this
    run(function * () {
      var hash = yield self.getHash(git)
      var value = yield git.loadAs('commit', hash)
      return Object.assign({}, value, {
        tree: new Tree(value.tree),
        parents: value.parents
          ? value.parents.map(hash => new Commit(hash))
          : value.parents
      })
    }, cb)
  }

  static of (def) {
    return new Commit((git, cb) => run(function * () {
      var commit = Object.assign({}, def, {
        tree: yield def.tree.getHash(git),
        parents: def.parents && def.parents.length > 0
          ? yield def.parents.map(x => x.getHash(git))
          : []
      })
      var hash = yield git.saveAs('commit', commit)
      return hash
    }, cb))
  }

  // getParent (index = 0) {
  //   return new Commit(async git => await git.revParse(`${ await this.getSha(git) }^${ index + 1 }`))
  // }

  // getTree () {
  //   return new Tree(async git => (await this.getSha(git)) + `^{tree}`)
  // }

  // getMessage () {
  //   return new Blob(async git => await Blob.of((await git.getCommit(await this.getSha(git))).message).getSha(git))
  // }

  // find (fn) {
  //   return new Commit(async git => {
  //     var rec = async function (commit) {
  //       var rez = fn(commit)
  //       rez = rez instanceof Blob
  //         ? JSON.parse((await git.cat(await rez.getSha(git))).toString())
  //         : rez
  //       if (rez) {
  //         return commit
  //       } else {
  //         return await rec(commit.getParent())
  //       }
  //     }
  //     return await (await rec(this)).getSha(git)
  //   })
  // }

  // static create (tree, parents = [], message = '') {
  //   return new Commit(async (git) => {
  //     var treeSha = await tree.getSha(git)
  //     var parentShas = await Promise.all(parents.map(p => p.getSha(git)))
  //     return await git.commitTree(treeSha, parentShas, message)
  //   })
  // }

  // grow2 (fn1, fn2) {
  //   return new Commit(async git => {
  //     var thisCommit = await git.getCommit(await this.getSha(git))
  //     if (thisCommit.tree === Tree.emptySha) return thisCommit.sha // wow
  //     return await (
  //       thisCommit.parents && (await git.getCommit(thisCommit.parents[0])).tree !== Tree.emptySha
  //         ? fn2(
  //             new Commit(thisCommit.parents[0]),
  //             new Commit(thisCommit.sha),
  //             new Commit(await new Commit(thisCommit.parents[0]).grow2(fn1, fn2).getSha(git))
  //           )
  //         : fn1(new Commit(thisCommit.sha))
  //     ).getSha(git)
  //   })
  // }

  // grow (newRoot) {
  //   return new Commit(async git => {
  //     var thisCommit = await git.getCommit(await this.getSha(git))
  //     if (!thisCommit.parents) throw new Error('!thisCommit.parents')
  //     if (thisCommit.parents.length !== 2) throw new Error('thisCommit.parents.length !== 2')

  //     var newRootParents = await git.exec('rev-list --first-parent ' + await newRoot.getSha(git), [x => x.split('\n').slice(0, -1)])
  //     var indexOfoldRoot = newRootParents.indexOf(thisCommit.parents[1])
  //     if (indexOfoldRoot === 0) {
  //       return thisCommit.sha
  //     } else {
  //       var oldRootCommit = new Commit(thisCommit.parents[1])
  //       var newRootCommit = indexOfoldRoot === -1
  //         ? new Commit(thisCommit.parents[1]).grow(newRoot)
  //         : newRoot
  //       var oldTreeCommit = new Commit(thisCommit.sha)
  //       var prevCommit = oldTreeCommit
  //       var maybeSeedCommitSha = await git.exec('rev-list --first-parent --max-parents=0 ' + thisCommit.sha, [x => x.trim()])
  //       var seedSignature = await git.revParse(maybeSeedCommitSha + ':seed.js')
  //       var script = (await git.cat(seedSignature)).toString()
  //       var seed = makeSeed(script)
  //       return await (
  //         seed(oldRootCommit.getTree(), newRootCommit.getTree(), oldTreeCommit.getTree())
  //           .commit(
  //             [prevCommit, newRootCommit],
  //             seedSignature
  //           )
  //       ).getSha(git)
  //     }
  //   })
  // }

  // branch (script) {
  //   return new Commit(async git => {
  //     var seedSignature = await script.getSha(git)
  //     var seedCommits = await git.exec(
  //       'rev-list --all --reflog --parents --min-parents=2 --grep=' + seedSignature,
  //       [x => x.split('\n').slice(0, -1).map(x => x.split(' ')).map(x => ({ sha: x[0], parents: x.slice(1) }))]
  //     )
  //     var thisParents = await git.exec('rev-list --first-parent ' + await this.getSha(git), [x => x.split('\n').slice(0, -1)])
  //     var oldTreeCommit = seedCommits.find(c => thisParents.indexOf(c.parents[1]) >= 0)

  //     if (oldTreeCommit) {
  //       return await new Commit(oldTreeCommit.sha).grow(this).getSha(git)
  //     } else {
  //       var seedCommit = Commit.create(Tree.of({ 'seed.js': script }), [], 'seed')
  //       var seed = makeSeed((await git.cat(seedSignature)).toString())
  //       return await seed(new Tree(), this.getTree(), new Tree())
  //         .commit([seedCommit, this], seedSignature)
  //         .getSha(git)
  //     }
  //   })
  // }
}

function makeSeed (script, commit) {
  var vm = require('vm')
  var sandbox = { console, commit, seed: {}, Tree, Blob }
  vm.runInNewContext(script, sandbox)
  return sandbox.seed
}

Tree.prototype.commit = function (parents, message) {
  return Commit.create(this, parents, message)
}

function ensure (assertFn) {
  if (!assertFn()) throw new Error(assertFn.toString())
}

module.exports = { Commit }
