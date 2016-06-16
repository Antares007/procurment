const assert = require('assert').ok
const debug = require('debug')('module')
const runInThisContext = require('vm').runInThisContext
const path = require('path')

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
    var wrappedCode = `(function (exports, require, module, __filename, __dirname) {${script}})`
    var compiledWrapper = runInThisContext(wrappedCode, {
      filename: this.filename,
      lineOffset: 0,
      displayErrors: true
    })
    const args = [this.exports, this.require, this, this.filename, this.dirname]
    compiledWrapper.apply(this.exports, args)
  }

  load (script) {
    debug('load %j for module %j', this.filename, this.id)
    assert(!this.loaded)
    this._compile(script)
    this.loaded = true
  }
}
module.exports = Module

Module._cache = {}
