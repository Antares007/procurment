var shaRegex = /^[0123456789abcdef]{40}$/
var debug = require('debug')('tree') // eslint-disable-line
var emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

export class GitObject {
  constructor (shaFn) {
    if (typeof shaFn === 'string') {
      if (shaRegex.test(shaFn)) {
        this.shaFn = (git) => shaFn
      } else {
        this.shaFn = (git) => git.revParse(shaFn)
      }
    } else {
      this.shaFn = shaFn
    }
  }
  getSha (git) {
    if (this.promisedSha) return this.promisedSha
    this.promisedSha = this.shaFn(git)
    return this.promisedSha
  }
}

export class Blob extends GitObject {
  constructor (gitContext) {
    super(gitContext)
    this.isBlob = true
  }

  static of (value) {
    return new Blob(async (git) => {
      return await git.hashObject(new Buffer(JSON.stringify(value)))
    })
  }

  update (fn) {
    fn = applyBufferConvert(fn)
    return new Blob(async (git) => await git.hashObject(fn(await git.cat(await this.getSha(git)))))
  }

  merge (other, merger) {
    merger = applyBufferConvert(merger)
    return new Blob(async (git) => {
      return await git.hashObject(
        merger(
          await git.cat(await this.getSha(git)),
          await git.cat(await other.getSha(git))
        )
      )
    })
  }

  toTree (fn) {
    fn = applyBufferConvert(fn)
    return new Tree(async (git) => {
      var entries = []
      var buffer = await git.cat(await this.getSha(git))

      fn.call({
        emit: function (path, buffer) {
          entries.push({ path, buffer })
        },
        link: function (path, sha) {
          entries.push({ path, sha })
        }
      }, buffer)

      var treeEntries = await Promise.all(
        entries.map(async e => ({
          mode: '100644',
          type: 'blob',
          sha: e.sha ? e.sha : await git.hashObject(e.buffer),
          path: e.path
        }))
      )

      return await git.mkDeepTree(emptyTreeSha, treeEntries)
    })
  }
}

export class Tree extends GitObject {
  constructor (gitContext) {
    super(typeof gitContext === 'undefined' ? () => emptyTreeSha : gitContext)
    this.isTree = true
  }

  getBlob (path) {
    return new Blob(async (git) => {
      var sha = await this.getSha(git)
      return await git.revParse(sha + ':' + path)
    })
  }

  get (path, nullValue = new Tree()) {
    return new Tree(async (git) => {
      var sha = await this.getSha(git)
      try {
        var target = await git.revParse(sha + ':' + path)
        return target
      } catch (ex) {
        if (ex.message.indexOf('does not exist in') >= 0 ||
           ex.message.indexOf('exists on disk, but not in') >= 0) {
          return await nullValue.getSha(git)
        }
        throw ex
      }
    })
  }

  rm (other) {
    return new Tree(
      async (git) => await git.mkDeepTree(
        await this.getSha(git),
        (await git.lsTree(await other.getSha(git), true))
          .map(e => ({ status: 'D', path: e.path }))
      )
    )
  }

  merge (other) {
    return new Tree(
      async (git) => await git.mkDeepTree(
        await this.getSha(git),
        (await git.lsTree(await other.getSha(git), true))
          .map(e => ({ status: 'A', path: e.path, newSha: e.sha, newMode: e.mode }))
      )
    )
  }

  merge3 (ours, theirs, fn) {
    var mkParam = (x) => x
      ? (x.mode.indexOf('100') === 0
         ? new Blob(x.sha)
         : new Tree(x.sha))
      : undefined

    return new Tree(
      async (git) => {
        var sha1 = await this.getSha(git)
        var sha2 = await ours.getSha(git)
        var sha3 = await theirs.getSha(git)
        debug('merged')
        debug(await git.lsTree(sha1))
        debug(await git.lsTree(sha2))
        debug(await git.lsTree(sha3))
        var rezSha = await git.merge3(
          sha1,
          sha2,
          sha3,
          async function (base, ours, theirs) {
            var merged = fn(mkParam(base), mkParam(ours), mkParam(theirs))
            if (JSON.parse((await git.cat(await merged.getSha(git))).toString()) === null) {
              return {
                status: 'D'
              }
            } else {
              return {
                mode: merged instanceof Blob ? '100644' : '040000',
                sha: await merged.getSha(git)
              }
            }
          }
        )
        debug(await git.lsTree(rezSha))
        return rezSha
      }
    )
  }

  diff (other) {
    return new Tree(async (git) => {
      var patchStream = git.diffTree(await this.getSha(git), await other.getSha(git))
        .transform(function (patch, next) {
          if (patch.status === 'M') {
            this.push({ newMode: patch.newMode, status: 'A', path: 'modified/new/' + patch.path, newSha: patch.newSha })
            this.push({ newMode: patch.oldMode, status: 'A', path: 'modified/old/' + patch.path, newSha: patch.oldSha })
          } else if (patch.status === 'A') {
            this.push({ newMode: patch.newMode, status: 'A', path: 'added/' + patch.path, newSha: patch.newSha })
          } else {
            this.push({ newMode: patch.oldMode, status: 'A', path: 'deleted/' + patch.path, newSha: patch.oldSha })
          }
          next()
        })
      return await git.mkDeepTree(emptyTreeSha, patchStream)
    })
  }

  map (fn) {
    return new Tree(async (git) => {
      var patchStream = git.diffTree(emptyTreeSha, await this.getSha(git))
        .transform(async function (patch) {
          var object = fn(new Blob(patch.newSha), patch.path)
          if (!object) return
          var sha = await object.getSha(git)
          if (object instanceof Tree) {
            for (var entry of await git.lsTree(sha, true)) {
              this.push({
                newMode: entry.mode,
                status: 'A',
                path: patch.path + '/' + entry.path,
                newSha: entry.sha
              })
            }
          } else {
            patch.newSha = sha
            this.push(patch)
          }
        })
      return await git.mkDeepTree(emptyTreeSha, patchStream)
    })
  }

  filter (fn) {
    return new Tree(async (git) => {
      var patchStream = git.diffTree(emptyTreeSha, await this.getSha(git))
        .transform(async function (patch) {
          var object = fn(new Blob(patch.newSha), patch.path)
          var rez = object instanceof Blob
            ? JSON.parse((await git.cat(await object.getSha(git))).toString())
            : object
          if (rez) this.push(patch)
        })
      return await git.mkDeepTree(emptyTreeSha, patchStream)
    })
  }

  applyPatch (patchs) {
    return new Tree(async (git) => {
      return await git.mkDeepTree(await this.getSha(git), patchs)
    })
  }

  cd (fn) {
    return new Tree(async (git) => {
      var entries = (await git.lsTree(await this.getSha(git)))
        .map(e => Object.assign(e.type === 'blob' ? new Blob(e.sha) : new Tree(e.sha), e))
      var tree = {}
      fn.call(tree, entries)
      return await Tree.of(tree).getSha(git)
    })
  }

  static of (tree) {
    if (Object.keys.length === 0) {
      return new Tree(() => emptyTreeSha)
    }
    return new Tree(async (git) => {
      Object.keys(tree).forEach(function (key) {
        if (tree[key] instanceof Tree || tree[key] instanceof Blob) {
          return
        }
        if (Object.getPrototypeOf(tree[key]) === Object.prototype) {
          tree[key] = Tree.of(tree[key])
        } else {
          tree[key] = Blob.of(tree[key])
        }
      })

      return await git.mktree(
        await Promise.all(
          Object.keys(tree).map(async function(name) {
            var e = tree[name]
            var type = e instanceof Tree ? 'tree' : 'blob'
            var mode = e instanceof Tree ? '040000' : '100644'
            var sha = await e.getSha(git)
            return { mode, type, sha, name }
          })
        )
      )
    })
  }

  commit (parents, message) {
    return Commit.create(this, parents, message)
  }

  toBlob (fn) {
    return new Blob(async (git) => {
      var sha = await this.getSha(git)
      if (sha === Tree.emptySha) return Blob.of(null)
      var entries = (await git.lsTree(sha))
        .map(e => Object.assign(e.type === 'blob' ? new Blob(e.sha) : new Tree(e.sha), e))
      return await fn(entries).getSha(git)
    })
  }
}
Tree.emptySha = emptyTreeSha

export class Commit extends GitObject {
  constructor (gitContext) {
    super(gitContext)
    this.isCommit = true
  }

  getParent (index = 0) {
    return new Commit(async git => `${ await this.getSha(git) }^${ index + 1 }`)
  }

  getTree () {
    return new Tree(async git => (await this.getSha(git)) + `^{tree}`)
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

function isNotBufferInArgName (s) {
  return s.slice('buffer'.length * -1).toLowerCase() !== 'buffer'
}

function applyBufferConvert (fn) {
  var fnstr = fn.toString()
  var argNames = fnstr.slice(fnstr.indexOf('(') + 1, fnstr.indexOf(')'))
    .split(',')
    .map(x => x.trim())
  return function (...args) {
    var rez = fn.apply(
      {
        emit: (path, buffer) => this.emit(
          path,
          buffer instanceof Buffer
            ? buffer
            : new Buffer(JSON.stringify(buffer, null, '  '))
        ),
        link: (path, sha) => this.link(path, sha)
      },
      args.map(
        (a, i) => isNotBufferInArgName(argNames[i]) && a instanceof Buffer
               ? JSON.parse(a.toString())
               : a
      )
    )
    if (typeof rez !== 'undefined') {
      return rez instanceof Buffer ? rez : new Buffer(JSON.stringify(rez, null, '  '))
    }
  }
}
