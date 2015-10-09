var xlsx = require('xlsx')
const addressRegEx = /^([A-Z]+)([0-9]+)$/

module.exports = function (data) {
  var workbook = xlsx.read(data)
  return workbook.SheetNames.map(function (sheetName) {
    return {
      name: sheetName,
      rows: function () {
        var ws = workbook.Sheets[sheetName]
        return Object.keys(ws).reduce(function (rez, address) {
          var groups = addressRegEx.exec(address)
          if (!groups) return rez
          var row = parseInt(groups[2], 10) - 1
          var col = simToIndex(groups[1]) - 1
          rez[row] = rez[row] || []
          rez[row][col] = formatCell(ws[address])
          return rez
        }, [])
      }
    }
  })
}

function simToIndex (sim) {
  return sim.split('').reverse().reduce(function (s, x, i) {
    var simValue = x.charCodeAt(0) - 65 + 1
    s = s + Math.pow(26, i) * simValue
    return s
  }, 0)
}

function formatCell (cell) {
  if (cell) {
    if (typeof cell.v === 'number' && looksLikeDate(cell.w)) {
      return getDate(cell.v)
    }
    return cell.v
  }
  return cell
}

function looksLikeDate (v) {
  if (typeof v !== 'string') {
    return false
  }
  var dot = 0
  for (var i = 0, len = v.length; i < len; i++) {
    var chr = v[i]
    if (chr === '.') { dot++ }
    if (dot > 1 || chr === '/' || chr === ':') {
      return true
    }
  }
  return false
}

function getDate (excelDateValue) {
  return new Date(Math.round((excelDateValue - 25569) * 60 * 60 * 24 * 1000))
}
