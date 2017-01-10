'use strict';
const path = require('path');
//const process = require('process');
const Generator = require('yeoman-generator');
const _ = require('lodash');
const settings = require('../conf.js');
const mkdirp = require('mkdirp');
let _g = null;


module.exports = Generator.extend({
  initializing: function () {
        _g = this;
  },
  prompting: function () {

  },
  writing: function () {
    
  },

  install: function () {
    const execDir = path.join(this.sourceRoot(), '..', '..');
    const settings = this.config.getAll().promptValues;
    const fullOutputPath = path.join(this.destinationRoot(), settings.outputPath);
    this.spawnCommand('gulp', ['export', '--docId', settings.docId, '--credsPath', settings.credsPath, '--outputPath', fullOutputPath], {
        cwd: execDir
    }).on('close', () => {
       
    })
  }
});


