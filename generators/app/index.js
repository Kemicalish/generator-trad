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
    const prompts = [{
      type: 'input',
      name: 'docId',
      message: 'Google Spreadsheet id? (you should copy/paste it)',
      store: true
    },
    {
      type: 'input',
      name: 'credsPath',
      message: 'Path to your google spreadsheet credentials.json file',
      default: process.cwd(),
      store: true
    },
    {
      type: 'input',
      name: 'outputPath',
      message: 'Relative path to your output directory',
      default: 'localized',
      store: true
    }];

    return this.prompt(prompts).then(function (props) {
      // To access props later use this.props.someAnswer;
      this.props = props;
    }.bind(this));
  },
  writing: function () {
    
  },

  install: function () {
    const execDir = path.join(this.sourceRoot(), '..', '..');
    const settings = this.config.getAll().promptValues;
    const fullOutputPath = path.join(this.destinationRoot(), settings.outputPath);
    this.spawnCommand('gulp', ['init', '--docId', settings.docId, '--credsPath', settings.credsPath, '--outputPath', fullOutputPath], {
        cwd: execDir
    }).on('close', () => {
       
    })
  }
});


