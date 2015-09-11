var { GitObject } = require('./gitobject')
var { Tree } = require('./tree')
var debug = require('debug')('commit');

export class Commit extends GitObject {
  constructor (gitContext) {
    super(gitContext)
  }

  getTree() {
    return new Tree(async git => (await this.getSha(git)) + `^{tree}`)
  }

  static create (tree, parents=[], message='') {
    return new Commit(async (git) => {
      var treeSha = await tree.getSha(git)
      var parentShas = await Promise.all(parents.map(p => p.getSha(git)))
      return await git.commitTree(treeSha, parentShas, message)
    })
  }

  grow (fn1, fn2, seedId) {
    return new Commit(async git => {

      var growTree = async function(rootSha) {

        var cachedRez = git.getTreeFromCache(rootSha, seedId)
        if(cachedRez) return cachedRez

        var thisCommit = await git.getCommit(rootSha)
        var newTreeCommit = thisCommit.parents
          ? fn2(
              new Commit(thisCommit.parents[0]),
              new Commit(thisCommit.sha),
              new Commit(await growTree(thisCommit.parents[0]))
            )
          : fn1(new Commit(thisCommit.sha))
        var newTreeSha = await newTreeCommit.getSha(git) 

        git.setTreeCache(rootSha, seedId, newTreeSha)

        return newTreeSha
      }

      return await growTree(await this.getSha(git))
    })
  }
}
