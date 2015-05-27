var debug = require('debug')('tesli');
var emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';


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
        var {newSha, oldSha, path} = patch;
        var newObject = newSha ? fn(path, new Blob(newSha)) : null;
        var oldObject = oldSha ? fn(path, new Blob(oldSha)) : null;
        var isTree = (newObject || oldObject) instanceof Tree;
        var mode = isTree ? '040000' : '100644';

        if(newSha && oldSha){
          this.push({ status: 'M', path, newSha: await git.hashObject(newBuffer),
                    oldSha: await git.hashObject(oldBuffer), mode: '100644' });
        } else if(newSha){
          this.push({ status: 'A', path, newSha: await git.hashObject(newBuffer), mode: '100644' });
        } else {
          this.push({ status: 'D', path, oldSha: await git.hashObject(oldBuffer), mode: '100644' });
        }

      })
    );
  }

  transformold(fn){
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
      .pipe(require('./logprogress.js')(10));

      return git.mkDeepTree(await tree.getSha(git), patchsStream);
    });
  }
}

