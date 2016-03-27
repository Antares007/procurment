'use strict'
var Hashish = require('./hashish')
var Tree = require('./tree')
var Blob = require('./blob')

class Commit extends Hashish {
  valueOf (git) {
    return this.getHash(git).then(function (hash) {
      return git.loadAs('commit', hash).then(function (value) {
        var commit = Object.assign({}, value, {
          tree: Hashish.get(Tree, value.tree),
          parents: value.parents.map((hash) => Hashish.get(Commit, hash))
        })
        if (commit.parents.length === 0) {
          delete commit.parents
        }
        return commit
      })
    })
  }

  static of (def) {
    var objs = (def.parents || []).concat(def.tree)
    return new Commit(
      (git) => Promise.all(objs.map((o) => o.getHash(git)))
        .then((hashes) => {
          var treeHash = hashes.pop()
          var parentHases = hashes
          var commit = Object.assign({}, def, {
            tree: treeHash,
            parents: parentHases
          })
          return git.saveAs('commit', commit)
        })
    )
  }

  branch (script) {
    return branch(this, script)
  }

  grow (newRoot) {
    return grow(this, newRoot)
  }
}
Commit.prototype.mode = parseInt('160000', 8)
module.exports = Commit

var author = () => ({
  name: 'Archil Bolkvadze',
  email: 'a.bolkvadze@gmail.com',
  date: new Date()
})

function growSeed (script, oldRoot, newRoot, oldTree) {
  return script.bind(Tree, (buffer) => {
    var vm = require('vm')
    var sandbox = { console, seed: {}, Tree, Blob, Commit, Buffer }
    vm.runInNewContext(buffer.toString(), sandbox)
    return sandbox.seed(oldRoot, newRoot, oldTree)
  })
}

function branch (root, script) {
  return root.bind(Commit, (commit) => {
    var seedCommit = Commit.of({
      tree: Tree.of({ 'seed.js': script }),
      author: author(),
      committer: author(),
      message: 'initial Commit'
    })

    var newTree = growSeed(script, Tree.of({}), commit.tree, Tree.of({}))

    return Commit.of({
      tree: newTree,
      parents: [ seedCommit, root ],
      author: author(),
      committer: author(),
      message: script.hash
    })
  })
}

function grow (oldTree, newRoot) {
  return oldTree.bind(Commit, (oldTreeCommit) => {
    return newRoot.bind(Commit, (newRootCommit) => {
      return oldTreeCommit.parents[1].bind(Commit, (oldRootCommit) => {
        var script = Hashish.get(Blob, oldTreeCommit.message)
        var newTree = growSeed(script, oldRootCommit.tree, newRootCommit.tree, oldTreeCommit.tree)
        return Commit.of({
          tree: newTree,
          parents: [ oldTree, newRoot ],
          author: author(),
          committer: author(),
          message: oldTreeCommit.message
        })
      })
    })
  })
}
