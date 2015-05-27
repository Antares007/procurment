var { GitObject } = require('./gitobject');
var debug = require('debug')('blob');

export class Blob extends GitObject {
  constructor(gitContext){
    super(gitContext)
  }


  static of(value){
    return new Blob(async (git) => {
      return await git.hashObject(new Buffer(JSON.stringify(value)));
    });
  }

  merge(other, merger){
    return new Blob(async (git) => {
      return await git.hashObject(
        merger(
          await git.cat(await this.getSha(git)),
          await git.cat(await other.getSha(git))
        )
      );
    });
  }

  // toTree(fn){
  //   return new Tree(async (git) => {
  //     var entries = [];
  //     var buffer = await git.cat(await this.getSha(git));

  //     fn.call({
  //       emit: function(path, buffer){
  //         entries.push({ path, buffer });
  //       }
  //     }, buffer);

  //     var treeEntries = await Promise.all(
  //       entries.map(async e => ({
  //         mode: '100644',
  //         type: 'blob',
  //         sha: await git.hashObject(e.buffer),
  //         path: e.path
  //       }))
  //     );

  //     return await git.mkDeepTree(emptyTreeSha, treeEntries);
  //   });
  // }
}
