'use strict';
const path = require('path');
const assert = require('yeoman-assert');
const helpers = require('yeoman-test');
const _ = require('lodash');
const PSD = require('psd');

const testPrompt = {
  projectName: 'PROJECT',
  websiteName: 'WEBSITE'
};
const staticSkinPrompt = _.merge({format: 'staticskin'}, testPrompt);
const prerollPrompt = _.merge({format: 'preroll'}, testPrompt);
const badFormatPrompt = _.merge({format: 'xoxoxoxo'}, testPrompt);

let settings = require('../generators/conf.js');

const backgroundTextFile = path.join(settings.DESTINATION_DIRNAME, 'background_color.txt');
const psdFile = path.join(settings.DESTINATION_DIRNAME, 'PSD', `${testPrompt.projectName}_${testPrompt.websiteName}.psd`);


const expectedFiles = [
  path.join(settings.DESTINATION_DIRNAME, 'DEMO', 'demo.html'),
  path.join(settings.DESTINATION_DIRNAME, 'DEMO', 'static_skin_demo.jpg'),
  backgroundTextFile,
  psdFile,
  path.join(settings.DESTINATION_DIRNAME, `${testPrompt.projectName}_${testPrompt.websiteName}.jpg`)
];


describe('STATIC SKIN', function () {
  before(function () {
    return helpers.run(path.join(__dirname, '../generators/app'))
      .withPrompts(staticSkinPrompt)
      .toPromise();
  });

  _.each(expectedFiles, file => {
    it('creates ' + file, function () {
      assert.file([
        file
      ]);
    });
  });

  it(`${backgroundTextFile} should contain a default color in hex`, () => {
      assert.fileContent(backgroundTextFile, /#[0-9a-fA-F]+/);
  });

  it(`${psdFile} should contain a WEBSITE group (with target website sample content)`, () => {
      const psd = PSD.fromFile(psdFile);
      psd.parse();
      const tree = psd.tree().export();
      assert.ok(_.find(tree.children, {type: 'group', name: 'WEBSITE'}));
  });
});

describe('PRE-ROLL', function () {
  before(function () {
    return helpers.run(path.join(__dirname, '../generators/app'))
      .withPrompts(prerollPrompt)
      .toPromise();
  });

  it('NO TEST YET, it should work ^^', () => {
      assert(true);
  });

});

describe('BAD FORMAT', function () {
  before(function () {
    return helpers.run(path.join(__dirname, '../generators/app'))
      .withPrompts(badFormatPrompt)
      .toPromise();
  });

  it('NO TEST YET, it should work ^^', () => {
      //TODO: should assert an error 
      assert(true);
  });

});

