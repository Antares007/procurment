var emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
var debug = require('debug')('tesli');

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
    var self = this;
    return new Tree(async (git) => {
      var tree = (await git.lsTree(await this.getSha(git))).reduce(function(tree, entry){
        tree[entry.name] = entry.type === 'tree' ? new Tree(entry.sha) : new Blob(entry.sha);
        return tree;
      }, {});

      fn.call(tree, tree);

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

  reduce(fn){
    var self = this;
    return new Blob(async (git) => {
      var sha = await this.getSha(git);
      debug('reduceing: ' + sha);
      var entries = await git.lsTree(sha);

      var shas = await Promise.all(
        entries.map(x => x.type === 'tree' ? new Tree(x.sha).reduce(fn).getSha(git) : x.sha)
      );

      var buffers = await Promise.all(shas.map(x => git.cat(x)));
      var blobSha = await git.hashObject(fn(buffers));
      debug('rediced: ' + sha +' -> ' + blobSha);
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

      return await git.mkDeepTree(treeEntries);
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

  transform(fn){
    return new Diff(
      this.tree1, this.tree2,
      (git, astream) => this.streamOperations(git, astream).transform(async function(patch){
        var emitedPaths = {};
        var transform = async function(prefix){
          var shaPropName = prefix + 'Sha';
          var bufferPropName = prefix + 'Buffer';
          var emiter = function(path, buffer){
            var newPatch = emitedPaths[path];
            if(!newPatch){
              emitedPaths[path] = { [bufferPropName]: buffer };
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
    return new Tree(async (git) => {
      var patchsStream = this.streamOperations(
        git,
        git.diffTree(
          await this.tree1.getSha(git),
          await this.tree2.getSha(git)
        )
      );
      var index = git.openIndex('testIndex2');

      await index.readTree(await new Tree().getSha(git));

      await patchsStream
        .map(function(p){
          var { path, status, newSha, mode } = p;
          return `${mode} ${newSha}\t${status}/${path}\n`
        })
        .pipe(require('./logprogress.js')(10))
        .writeTo(index.createUpdateIndexInfoStream());

      return await index.writeTree();
    });
  }

  apply(tree){
    return new Tree(async (git) => {
      var patchsStream = this.streamOperations(
        git,
        git.diffTree(
          await this.tree1.getSha(git),
          await this.tree2.getSha(git)
        )
      );

      var index = git.openIndex('testIndex2');

      await index.readTree(await tree.getSha(git));

      await patchsStream
        .map(function(p){
          var { path, status, newSha, mode } = p;
          if(status !== 'D'){
            return `${mode} ${newSha}\t${path}\n`
          } else {
            return `0 0000000000000000000000000000000000000000\t${path}\n`;
          }
        })
        .pipe(require('./logprogress.js')(10))
        .writeTo(index.createUpdateIndexInfoStream());

      return await index.writeTree();
    });
  }
}
var crypto = require('crypto');
function hash(value){
  var shasum = crypto.createHash('sha1');
  shasum.update(value.toString());
  return shasum.digest('hex');
}
