import { GitObject } from './gitobject'
import { Blob } from './blob'
import debuger from 'debug' // eslint-disable-line
let debug = debuger('tree')

const emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const nullSha = 'ec747fa47ddb81e9bf2d282011ed32aa4c59f932'

export class Tree extends GitObject {
  constructor (gitContext) {
    super(typeof gitContext === 'undefined' ? () => emptyTreeSha : gitContext)
    this.isTree = true
  }

  clear () {
    return new Tree()
  }

  get (path, nullValue = new Tree()) {
    var Type = nullValue instanceof Tree ? Tree : Blob
    return new Type(async (git) => {
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
            if ([base, ours, theirs].filter(x => !!x).length > 1) {
              debug(JSON.stringify({ base, ours, theirs }, null, '  '))
            }
            var merged = fn(mkParam(base), mkParam(ours), mkParam(theirs))
            if (merged === null) {
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

  reduce (fn, initState) {
    if (initState instanceof GitObject) {
      return new initState.constructor(async (git) => {
        var entries = await git.lsTree(await this.getSha(git), true)
        var newState = entries.reduce((state, e) => fn(state, Object.assign(new Blob(e.sha), e), e.path), initState)
        return await newState.getSha(git)
      })
    } else {
      return new Blob(async (git) => {
        var entries = await git.lsTree(await this.getSha(git), true)
        var newState = entries.reduce((state, e) => fn(state, Object.assign(new Blob(e.sha), e), e.path), initState)
        return await Blob.of(newState).getSha(git)
      })
    }
  }

  map (fn) {
    return new Tree(async (git) => {
      var patchStream = git.diffTree(emptyTreeSha, await this.getSha(git))
        .transform(async function (patch) {
          var object = fn(new Blob(patch.newSha), patch.path)
          if (!object) return
          var sha = await object.getSha(git)
          if (sha === nullSha) return

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

  toBlob (fn, nullValue) {
    return new Blob(async (git) => {
      var sha = await this.getSha(git)
      if (sha === Tree.emptySha) return await Blob.of(nullValue).getSha(git)
      var entries = (await git.lsTree(sha))
        .map(e => Object.assign(e.type === 'blob' ? new Blob(e.sha) : new Tree(e.sha), e))
      return await fn(entries).getSha(git)
    })
  }
}
Tree.emptySha = emptyTreeSha
