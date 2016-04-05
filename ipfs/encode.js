var bs58 = require('bs58')
var protobuf = require('protocol-buffers')
var schema = 'message PBLink {optional bytes Hash = 1; optional string Name = 2;optional uint64 Tsize = 3;} message PBNode {repeated PBLink Links = 2; optional bytes Data = 1;}'
var mdagpb = protobuf(schema)

module.exports = {
  encode: function (node) {
    var pbo = toProtoBuf(node)
    var encoded = mdagpb.PBNode.encode(pbo)
    return encoded
  },
  decode: function (data) {
    var pbn = mdagpb.PBNode.decode(data)
    return pbn
  }
}

function toProtoBuf (node) {
  return node
  var pbn = {}

  if (node.data && node.data.length > 0) {
    pbn.Data = node.data
  } else {
    pbn.Data = null // new Buffer(0)
  }

  if (node.links.length > 0) {
    pbn.Links = []

    for (var i = 0; i < node.links.length; i++) {
      var link = node.links[i]
      pbn.Links.push({
        Hash: new Buffer(bs58.decode(link.hash)),
        Name: link.name,
        Tsize: link.size
      })
    }
  } else {
    pbn.Links = []
  }

  return pbn
}
