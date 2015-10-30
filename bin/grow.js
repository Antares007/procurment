#!/usr/bin/env node
'use strict'
require('babel/register')({ extensions: ['.es6', '.es', '.jsx', '.js'] })

var argv = require('yargs').argv
var mygit = require('../src/engine/mygit')
var Commit = require('../src/commit').Commit

mygit.getGitDir(function (err, dir) {
  if (err) throw err
  var git = mygit(dir)
  var batchCat = git.catFileBatch()
  git.cat = batchCat.cat

  git.revParse('HEAD')
    .then(function (sha) {
      return new Commit(sha).grow(new Commit(argv._[0])).getSha(git)
    })
    .then(function (sha) {
      batchCat.end()
      console.log(sha)
    })
    .catch(function (err) {
      process.nextTick(function () {
        throw err
      })
    })
})
