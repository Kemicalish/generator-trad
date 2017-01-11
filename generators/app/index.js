'use strict';
const path = require('path');
const Generator = require('yeoman-generator');
const _ = require('lodash');
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
    const settings = this.config.getAll().promptValues || {};

    this.spawnCommand('gulp', ['init', '--docId', settings.docId, '--credsPath', settings.credsPath], {
        cwd: execDir
    }).on('close', () => {
       
    })
  }
});


