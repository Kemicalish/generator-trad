'use strict';
const path = require('path');
//const process = require('process');
const Generator = require('yeoman-generator');
const _ = require('lodash');
let _g = null;


module.exports = Generator.extend({
  initializing: function () {
        _g = this;
  },
  prompting: function () {
    const prompts = [
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
    const settings = _.merge({}, this.config.getAll().promptValues, this.props);
    const fullOutputPath = path.join(this.destinationRoot(), settings.outputPath);
    this.spawnCommand('gulp', ['export', '--docId', settings.docId, '--credsPath', settings.credsPath, '--outputPath', fullOutputPath], {
        cwd: execDir
    }).on('close', () => {
       
    })
  }
});


