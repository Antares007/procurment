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

  grow2 (fn1, fn2) {
    return new Commit(async git => {
      var thisCommit = await git.getCommit(await this.getSha(git))
      if (thisCommit.tree === Tree.emptySha) return thisCommit.sha // wow
      return await (
        thisCommit.parents && (await git.getCommit(thisCommit.parents[0])).tree !== Tree.emptySha
          ? fn2(
              new Commit(thisCommit.parents[0]),
              new Commit(thisCommit.sha),
              new Commit(await new Commit(thisCommit.parents[0]).grow2(fn1, fn2).getSha(git))
            )
          : fn1(new Commit(thisCommit.sha))
      ).getSha(git)
    })
  }

  grow (newRoot) {
    return new Commit(async git => {
      var thisCommit = await git.getCommit(await this.getSha(git))
      if (!thisCommit.parents) throw new Error('!thisCommit.parents')
      if (thisCommit.parents.length !== 2) throw new Error('thisCommit.parents.length !== 2')

      var newRootParents = await git.exec('rev-list --first-parent ' + await newRoot.getSha(git), [x => x.split('\n').slice(0, -1)])
      var indexOfoldRoot = newRootParents.indexOf(thisCommit.parents[1])
      if (indexOfoldRoot === 0) {
        return thisCommit.sha
      } else {
        var oldRootCommit = new Commit(thisCommit.parents[1])
        var newRootCommit = indexOfoldRoot === -1
          ? new Commit(thisCommit.parents[1]).grow(newRoot)
          : newRoot
        var oldTreeCommit = new Commit(thisCommit.sha)
        var prevCommit = oldTreeCommit
        var maybeSeedCommitSha = await git.exec('rev-list --first-parent --max-parents=0 ' + thisCommit.sha, [x => x.trim()])
        var script = (await git.cat(await git.revParse(maybeSeedCommitSha + ':seed.js'))).toString()
        var seed = makeSeed(script)
        return await (
          seed(oldRootCommit.getTree(), newRootCommit.getTree(), oldTreeCommit.getTree())
            .commit(
              [prevCommit, newRootCommit],
              require('crypto').createHash('sha1').update(script).digest('hex')
            )
        ).getSha(git)
      }
    })
  }

  plant (script) {
    var seedCommit = Commit.create(Tree.of({ 'seed.js': new Buffer(script) }), [], 'seed')
    var prevCommit = seedCommit
    var seed = makeSeed(script)
    return seed(new Tree(), this.getTree(), new Tree())
      .commit(
        [prevCommit, this],
        require('crypto').createHash('sha1').update(script).digest('hex')
      )
  }

  branch (script) {
    return new Commit(async git => {
      var seedSignature = require('crypto').createHash('sha1').update(script).digest('hex')
      var seedCommits = await git.exec(
        'rev-list --all --reflog --parents --min-parents=2 --grep=' + seedSignature,
        [x => x.split('\n').slice(0, -1).map(x => x.split(' ')).map(x => ({ sha: x[0], parents: x.slice(1) }))]
      )
      var thisParents = await git.exec('rev-list --first-parent ' + await this.getSha(git), [x => x.split('\n').slice(0, -1)])
      var oldTreeCommit = seedCommits.find(c => thisParents.indexOf(c.parents[1]) >= 0)

      if (oldTreeCommit) {
        return await new Commit(oldTreeCommit.sha).grow(this).getSha(git)
      } else {
        return await this.plant(script).getSha(git)
      }
    })
  }
}

function makeSeed (script, commit) {
  var vm = require('vm')
  var sandbox = { console, commit, seed: {}, Tree }
  vm.runInNewContext(script, sandbox)
  return sandbox.seed
}

Tree.prototype.commit = function (parents, message) {
  return Commit.create(this, parents, message)
}
