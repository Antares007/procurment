import { GitObject } from './gitobject'
import { Tree } from './tree'

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

      return await git.mkDeepTree(Tree.emptySha, treeEntries)
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
