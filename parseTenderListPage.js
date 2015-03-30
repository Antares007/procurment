var idRegex = /^A(\d+)$/;
module.exports = function(htmlStr) {
  var $ = require('cheerio').load(htmlStr);
  return $('table').filter(function() {
    var id = $(this).find('tbody tr').first().attr('id');
    return idRegex.test(id);
  }).first()
  .find('tbody tr')
  .map(function() {
    return idRegex.exec($(this).attr('id'))[1];
  }).get();
};
