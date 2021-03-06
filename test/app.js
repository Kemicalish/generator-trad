'use strict';
const path = require('path');
const assert = require('yeoman-assert');
const helpers = require('yeoman-test');
const _ = require('lodash');
const scopeDir = '../generators/app';

const testPrompt = {
  docId: '1JJnLw93WnUxSEXgGYfoPoyj3hhoHeEgwulee1SH_T24'
};

//TODO test should use defined private credentials and this is not suitable in this public repo => find a way
//Thoses test are testing generators and NOT the main gulpfile.js which is where the main code lives
//When a proper way to test it with sample spreadsheet with "public credentials", add gulp.js to the test directory

describe('app', () => {
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

