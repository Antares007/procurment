import { GitObject } from './gitobject'
import { Tree } from './tree'
import { Blob } from './blob'

export class Commit extends GitObject {
  constructor (gitContext) {
    super(gitContext)
    this.isCommit = true
  }

  getParent (index = 0) {
    return new Commit(async git => await git.revParse(`${ await this.getSha(git) }^${ index + 1 }`))
  }

  getTree () {
    return new Tree(async git => (await this.getSha(git)) + `^{tree}`)
  }

  getMessage () {
    return new Blob(async git => await Blob.of((await git.getCommit(await this.getSha(git))).message).getSha(git))
  }

  find (fn) {
    return new Commit(async git => {
      var rec = async function (commit) {
        var rez = fn(commit)
        rez = rez instanceof Blob
          ? JSON.parse((await git.cat(await rez.getSha(git))).toString())
          : rez
        if (rez) {
          return commit
        } else {
          return await rec(commit.getParent())
        }
      }
      return await (await rec(this)).getSha(git)
    })
  }

  static create (tree, parents = [], message = '') {
    return new Commit(async (git) => {
      var treeSha = await tree.getSha(git)
      var parentShas = await Promise.all(parents.map(p => p.getSha(git)))
      return await git.commitTree(treeSha, parentShas, message)
    })
  }

  grow (fn1, fn2) {
    return new Commit(async git => {
      var thisCommit = await git.getCommit(await this.getSha(git))
      if (thisCommit.tree === Tree.emptySha) return thisCommit.sha // wow
      return await (
        thisCommit.parents
          ? fn2(
              new Commit(thisCommit.parents[0]),
              new Commit(thisCommit.sha),
              new Commit(await new Commit(thisCommit.parents[0]).grow(fn1, fn2).getSha(git))
            )
          : fn1(new Commit(thisCommit.sha))
      ).getSha(git)
    })
  }
}

Tree.prototype.commit = function (parents, message) {
  return Commit.create(this, parents, message)
}
