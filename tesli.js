var crypto = require('crypto');
var _ = require('lodash');
var debug = require('debug')('tesli');
var emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export class Tree {
  constructor(shaFn = (git) => Promise.resolve(emptyTreeSha)){
    this.isEmpty = true;
    if(typeof shaFn === 'string') {
      this.shaFn = (git) => Promise.resolve(shaFn);
    } else {
      this.shaFn = shaFn;
    }
  }

  getSha(git){
    if(this.promisedSha)
      return this.promisedSha;
    return this.promisedSha = this.shaFn(git);
  }

  get(path, nullValue){
    return new Tree(async (git) => {
      var sha = await this.getSha(git);
      try{
        var target = await git.revParse(sha + ':' + path);
        return target;
      } catch(ex){
        if(ex.message.indexOf('does not exist in') >= 0){
          return await nullValue.getSha(git);
        }
        throw ex;
      }
    });
  }

  diff(other){
    return new Diff(this, other);
  }

  cd(fn){
    return new Tree(async (git) => {
      var tree = (await git.lsTree(await this.getSha(git))).reduce(function(tree, entry){
        tree[entry.name] = entry.type === 'tree' ? new Tree(entry.sha) : new Blob(entry.sha);
        return tree;
      }, {});

      fn.call(tree, tree);

      return await Tree.of(tree).getSha(git);
    });
  }

  static of(tree){
    return new Tree(async (git) => {
      Object.keys(tree).forEach(function(key){
        if(tree[key] instanceof Tree || tree[key] instanceof Blob){
          return;
        }
        if(tree[key].__proto__ === Object.prototype){
          tree[key] = Tree.of(tree[key]);
        } else {
          tree[key] = Blob.of(tree[key]);
        }
      });

      return await git.mktree(
        await Promise.all(
          Object.keys(tree).map(async function(name){
            var e = tree[name];
            var type = e instanceof Tree ? 'tree' : 'blob';
            var mode = e instanceof Tree ? '040000' : '100644';
            var sha = await e.getSha(git);
            return { mode, type, sha, name };
          })
        )
      );
    });
  }

  reduce(depth, fn){
    if(typeof depth === 'function'){
      fn = depth;
      depth = 0;
    }
    return new Tree(async (git) => {
      var sha = await this.getSha(git);
      debug('reducing: ' + sha);
      var entries = await git.lsTree(sha);

      var newEntries = await Promise.all(
        entries.map(async function(e) {
          var {mode, type, sha, name} = e;
          if(type !== 'tree'){ return e; }
          if(depth === 0){
            sha = await (new Tree(sha).toBlob(fn).getSha(git));
            type = 'blob';
            mode = '100644';
          } else {
            sha = await (new Tree(sha).reduce(depth - 1, fn).getSha(git));
          }
          return {mode, type, sha, name};
        })
      );

      debug('reduced: ' + sha);
      return await git.mktree(newEntries);
    });
  }

  toBlob(fn){
    return new Blob(async (git) => {
      var sha = await this.getSha(git);
      debug('blobing: ' + sha);
      var entries = await git.lsTree(sha);

      var shas = await Promise.all(
        entries.map(x => x.type === 'tree' ? new Tree(x.sha).toBlob(fn).getSha(git) : x.sha)
      );

      var buffers = await Promise.all(shas.map(x => git.cat(x)));
      var blobSha = await git.hashObject(fn(buffers));
      debug('blobed: ' + sha +' -> ' + blobSha);
      return blobSha;
    });
  }

}

export class Blob {
  constructor(shaFn){
    if(typeof shaFn === 'string') {
      this.shaFn = (git) => Promise.resolve(shaFn);
    } else {
      this.shaFn = shaFn;
    }
  }
  static of(value){
    return new Blob(async (git) => {
      return await git.hashObject(new Buffer(JSON.stringify(value)));
    });
  }

  toTree(fn){
    return new Tree(async (git) => {
      var entries = [];
      var buffer = await git.cat(await this.getSha(git));

      fn.call({
        emit: function(path, buffer){
          entries.push({ path, buffer });
        }
      }, buffer);

      var treeEntries = await Promise.all(
        entries.map(async e => ({
          mode: '100644',
          type: 'blob',
          sha: await git.hashObject(e.buffer),
          path: e.path
        }))
      );

      return await git.mkDeepTree(emptyTreeSha, treeEntries);
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

  getSha(git){
    if(this.promisedSha)
      return this.promisedSha;
    this.promisedSha = this.shaFn(git);
    return this.promisedSha;
  }
}

class Diff {
  constructor(tree1, tree2, streamOperations = (git, astream) => astream){
    this.tree1 = tree1;
    this.tree2 = tree2;
    this.streamOperations = streamOperations;
  }

  filter(fn){
    return new Diff(
      this.tree1, this.tree2,
      (git, astream) => this.streamOperations(git, astream).filter(patch => fn(patch.path))
    );
  }

  partitionBy(fn){
    return new Diff(
      this.tree1, this.tree2,
      (git, astream) => this.streamOperations(git, astream).map(async function(patch){
        patch.path = fn(patch.path);
        return patch;
      })
    );
  }
  transform(fn){
    return new Diff(
      this.tree1, this.tree2,
      (git, astream) => this.streamOperations(git, astream).transform(async function(patch){
        var emitedPaths = {};
        var transform = async function(prefix){
          var i = 0;
          var shaPropName = prefix + 'Sha';
          var bufferPropName = prefix + 'Buffer';
          var emiter = function(path, buffer){
            var newPath = path + '/' + hash(patch.path + (i++).toString())
            var newPatch = emitedPaths[newPath];
            if(!newPatch){
              emitedPaths[newPath] = { [bufferPropName]: buffer };
            } else {
              if(!newPatch[bufferPropName]){
                newPatch[bufferPropName] = buffer;
              } else {
                this.emit('error', new Error('path already is leaf'));
              }
            }
          };
          fn.call({emit: emiter}, patch.path, await git.cat(patch[shaPropName]));
        };

        if(patch.newSha){ await transform('new'); }
        if(patch.oldSha){ await transform('old'); }

        for(var path in emitedPaths){
          var {oldBuffer, newBuffer} = emitedPaths[path];
          if(oldBuffer && newBuffer){
            this.push({ status: 'M', path, newSha: await git.hashObject(newBuffer),
                                           oldSha: await git.hashObject(oldBuffer), mode: '100644' });
          } else if(newBuffer){
            this.push({ status: 'A', path, newSha: await git.hashObject(newBuffer), mode: '100644' });
          } else {
            this.push({ status: 'D', path, oldSha: await git.hashObject(oldBuffer), mode: '100644' });
          }
        }
      })
    );
  }

  toTree(){
    return new Diff(
      this.tree1, this.tree2,
      (git, astream) => this.streamOperations(git, astream).transform(function(patch, next){
        var {status, path, newSha, oldSha, mode} = patch;
        if(newSha){
          this.push({ status: 'A', path: status + '/new/'+ path, newSha: newSha, mode: '100644' });
        }
        if(oldSha){
          this.push({ status: 'A', path: status + '/old/'+ path, newSha: oldSha, mode: '100644' });
        }
        next();
      })
    ).apply(new Tree());
  }

  apply(tree){
    return new Tree(async (git) => {
      var patchsStream = this.streamOperations(
        git,
        git.diffTree(
          await this.tree1.getSha(git),
          await this.tree2.getSha(git)
        )
      )
      .pipe(require('./logprogress.js')(1000));

      return git.mkDeepTree(await tree.getSha(git), patchsStream);
    });
  }
}

class Commit {
  constructor(shaFn = (git) => git.commitTree(emptyTreeSha)){
    this.isEmpty = true;
    if(typeof shaFn === 'string') {
      this.shaFn = (git) => Promise.resolve(shaFn);
    } else {
      this.shaFn = shaFn;
    }
  }

  getSha(git, message){
    if(this.promisedSha)
      return this.promisedSha;
    return this.promisedSha = this.shaFn(git);
  }

  plant(seed){
    return new Commit(async (git) => {

    });
  }

  grow(...rootCommits){
    return new Commit(async (git) => {
      var oldTree = await this.getTree()

      git.commitTree()
    });
  }
}

function hash(value){
  var shasum = crypto.createHash('sha1');
  shasum.update(value.toString());
  return shasum.digest('hex');
}
