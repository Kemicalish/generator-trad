'use strict';
const path = require('path');
const assert = require('yeoman-assert');
const helpers = require('yeoman-test');
const _ = require('lodash');
const scopeDir = '../generators/export';

const testPrompt = {
  docId: '1JJnLw93WnUxSEXgGYfoPoyj3hhoHeEgwulee1SH_T24'
};


describe('export', () => {
  before(function (done) {
    helpers.run(path.join(__dirname, scopeDir))
      .withPrompts(testPrompt)
      .on('end', done);
  });

  it('the generator can be required without throwing', () => {
    // not testing the actual run of generators yet
    require(scopeDir);
  });
});

