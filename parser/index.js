module.exports = {
  app_main:    require('./parseTenderMainPage.js'),
  app_docs:    require('./parseTenderAppDocsPage.js'),
  app_bids:    require('./parseTenderBidsPage.js'),
  app_result:  require('./parseTenderAppResultPage.js'),
  agency_docs: require('./parseTenderAgencyDocsPage.js')
};
