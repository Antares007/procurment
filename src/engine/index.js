import mygit from './mygit'

export async function start (dir) {
  var git = mygit(dir || await mygit.getGitDir())
  var batchCat = git.catFileBatch()
  git.cat = batchCat.cat
  git.stop = function () {
    batchCat.end()
  }
  return git
}
