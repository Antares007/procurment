const assert = require('assert').ok
const debug = require('debug')('module')
const runInThisContext = require('vm').runInThisContext
const path = require('path')

const fakeDate = class Date {
  getHours () { return 0 }
  getMinutes () { return 0 }
  getSeconds () { return 0 }
  getFullYear () { return 1975 }
  getMonth () { return 10 }
  getDate () { return 14 }
}

class Module {
  constructor (id, filename, parent) {
    this.id = id
    this.filename = filename
    this.dirname = path.dirname(filename)
    this.exports = {}
    this.loaded = false
    this.children = []
    this.parent = parent
    if (parent) parent.children.push(this)
  }

  _compile (script) {
    var wrappedCode = `(function (exports, require, module, __filename, __dirname, Date) {${script}})`
    var compiledWrapper = runInThisContext(wrappedCode, {
      filename: this.id.slice(0, 6) + ':' + this.filename.slice(1),
      lineOffset: 0,
      displayErrors: true
    })
    const args = [this.exports, this.require, this, this.filename, this.dirname, fakeDate]
    compiledWrapper.apply(this.exports, args)
  }

  load (script) {
    debug(`load ${this.id.slice(0, 6)}:${this.filename.slice(1)}`)
    assert(!this.loaded)
    this._compile(script)
    this.loaded = true
  }
}
Module._cache = {}
module.exports = Module
