'use strict';
const gulp = require('gulp');
const GoogleSpreadsheet = require('google-spreadsheet');
const gutil = require('gulp-util');
const _ = require('lodash');
const Readable = require('stream').Readable;
const File = gutil.File;
const path = require('path');
const defaultCredentialsFilename = 'credentials.json';
const defaultLanguagesSheetName = 'languages';
const defaultMasterSheetName = 'master';
const traceException = gutil.log;
const mandatorySheets = [defaultLanguagesSheetName, defaultMasterSheetName];

const argv = require('yargs').argv;

//const yorc = require(path.join()'./.yo-rc.json');
const prompts = {
	docId: argv.docId,
	credsPath: argv.credsPath,
	outputPath: argv.outputPath
};

let output = {
	languages:null,
	content:null
}

gulp.task('default', () => {

});

const feedOutputLanguages = languages => new Promise(resolve => {
	output.languages = languages;
	gutil.log('CURRENT OUTPUT');
	gutil.log(output);
	resolve(languages);
});

const feedOutputTexts = texts => new Promise(resolve => {
	output.content = texts;
	gutil.log('CURRENT OUTPUT');
	gutil.log(output);
	resolve(texts);
});

const getSheets = (doc) => new Promise((resolve, reject) => {
	doc.getInfo(function (err, sheetInfo) {
		if (err) {
			reject(err);
			return null;
		}

		gutil.log(sheetInfo.title + ' is loaded');

		const srcSheets = sheetInfo.worksheets;
		_.each(srcSheets, sheet => gutil.log(sheet.title + ' sheet found'));

		resolve(srcSheets);
	});
});

const createLoadSrcDoc = credsPath => docId => new Promise((resolve, reject) => {
	const creds = require(path.join(credsPath, defaultCredentialsFilename));
	const doc = new GoogleSpreadsheet(docId);

	doc.useServiceAccountAuth(creds, function (err) {
		if (err) {
			reject(err);
			return;
		}

		resolve(doc);
	});
});


const getLanguages = langSheet => new Promise((resolve, reject) => {
	langSheet.getCells({
		'min-row': 2,
		'max-col': 1,
		'return-empty': false
	}, function (err, cells) {

		if (err) {
			reject(err);
			return;
		}

		resolve(_.map(cells, c => c.value));
		return;
	});
});

const createGetNewLanguages = sheets => languages => new Promise((resolve) => {
	const titles = _.map(sheets, sheet => sheet.title)
	gutil.log('EXISTING SHEETS');
	gutil.log(titles);

	gutil.log('NEW LANGUAGES / SHEETS');
	const newLanguages = _.reject(languages, lg => _.find(titles, t => t === lg));
	gutil.log(newLanguages);

	resolve(newLanguages);
});

const createAddLanguageSheet = doc => language => new Promise((resolve, reject) => {
	gutil.log('START PROMISE ' + language);
	doc.addWorksheet({
		title: language
	}, function (err, sheet) {

		if (err) {
			reject(err);
			return;
		}

		sheet.resize({ rowCount: 200, colCount: 3 }, () => { 
			gutil.log('lg: ' + language);
			sheet.setHeaderRow(['ID', 'Source Text', 'Localized Text'], () => { 
				//gutil.log(`${language} processed`);
				gutil.log('END PROMISE ' + language);
				resolve(sheet);
			});
		});
	});
});

const getMasterContent = sheet => new Promise((resolve, reject) => {
	sheet.getCells({
		'min-row': 2,
		'max-col': 2,
		'return-empty': false
	}, function (err, cells) {

		if (err) {
			reject(err);
			return;
		}

		const texts = _.chain(cells)
			.groupBy(c => c.row)
			.toPairs()
			.map(kv => kv[1])
			.map(text => {
				const sortedText = _.sortBy(text, ['col']);

				return {
				id:sortedText[0].value,
				src:sortedText[1].value
			}})
			.value();


		resolve(texts);
		return;
	});
});

const getLangSheetContent = sheet => new Promise((resolve, reject) => {
	sheet.getCells({
		'min-row': 2,
		'max-col': 3,
		'return-empty': true
	}, function (err, cells) {

		if (err) {
			reject(err);
			return;
		}

		const texts = _.chain(cells)
			.groupBy(c => c.row)
			.toPairs()
			.map(kv => kv[1])
			.map(text => {
				const sortedText = _.sortBy(text, ['col']);
				return {
					id:sortedText[0].value,
					value:sortedText[2].value
			}})
			.filter(t => t.id !== '' && t.value !== '')
			.value();


		resolve({
			locale: sheet.title,
			texts: texts
		});
		return;
	});
});


const feedSheets = sheets => texts => new Promise((resolve, reject) => {
	_.map(sheets, sheet => new Promise((res, rej) => {
		sheet.getCells({
			'min-row': 2,
			'max-col': 2,
			'max-row': texts.length + 1,
			'return-empty': true
		}, function (err, cells) {

			if (err) {
				reject(err);
				return;
			}

			_.each(cells, (c, i) => {
					let textData = texts[Math.floor(i/2)];
					c.value = i % 2 === 0 ? textData.id : textData.src;
				});

			sheet.bulkUpdateCells(cells, () => {
				gutil.log(`${sheet.title} has been fed`);
			});

			return;
		});	
	}))
});

const createGetLocalizedSheets = sheets => languages => new Promise((resolve, reject) => {
	try{
		resolve(_.filter(sheets, s => _.find(languages, l => l === s.title)));
	}
	catch(err) {
		reject(err);
	}
});

const createFeedSheets = (master, sheets) => () => new Promise((resolve, reject) => {
	gutil.log('START FEEDING SHEETS');

	if(!output.languages) {
		reject('output.languages must be defined before calling createFeedSheets');
		return;
	}

	const langSheets = _.filter(sheets, s => _.find(output.languages, l => l === s.title));

	getMasterContent(master)
		.then(feedSheets(langSheets))
		.then(resolve, reject);
});



const readLocalesSheets = doc => new Promise((resolve, reject) => {
	getSheets(doc)
		.then(sheets => {

			const langSheet = _.find(sheets, { title: defaultLanguagesSheetName });
			const getLocalizedSheets = createGetLocalizedSheets(sheets);

			getLanguages(langSheet)
				.then(feedOutputLanguages)
				.then(getLocalizedSheets)
				.then(localizedSheets => Promise.all(_.map(localizedSheets, s => getLangSheetContent(s))))
				.then(resolve, reject);
		});	
});

const writeLocalesSheets = doc => new Promise((resolve, reject) => {

	getSheets(doc)
		.then(sheets => {
			//check si languages and master sont la
			_.each(mandatorySheets, sheetName => {
				if (!_.find(sheets, { title: sheetName })) {
					reject(`Missing Mandatory Sheet: ${sheetName}`);
					return;
				}
			});

			const langSheet 	= _.find(sheets, { title: defaultLanguagesSheetName });
			const masterSheet 	= _.find(sheets, { title: defaultMasterSheetName });
			const addLanguageSheet = createAddLanguageSheet(doc);
			const addLanguageSheets = newLanguages => Promise.all(_.map(newLanguages, lg => addLanguageSheet(lg)));

			getLanguages(langSheet)
				.then(feedOutputLanguages)
				.then(createGetNewLanguages(sheets))
				.then(addLanguageSheets)
				.then(createFeedSheets(masterSheet, sheets))
				.then(resolve);
		});

});

const writeFile = (filename, dest, content) => {
    const stream = new Readable({objectMode: true});
    stream._read = function () {
    };

    const joinedFile = new File({
        base: process.cwd(),
        path: path.join(process.cwd(), filename),
        contents: new Buffer(content)
    });

    stream.push(joinedFile);
    stream.push(null);

    stream.pipe(gulp.dest(dest));
}

const writeJsonFile = (filename, dest, content) => writeFile(filename, dest, JSON.stringify(content, null, 2));

const writeOutput = () => new Promise((resolve, reject) => {
	const dest = path.join('.', prompts.outputPath);
	_.each(output.content, val => {
		writeJsonFile(`${val.locale}.json`, dest, val.texts);
	});
});

const loadSrcDoc = createLoadSrcDoc(prompts.credsPath);
const exportSrcDoc = doc => new Promise((resolve, reject) => {

	readLocalesSheets(doc)
		.then(feedOutputTexts)
		.then(writeOutput);
});

gulp.task('init', () => {

	gutil.log('INIT/UPDATE SPREADSHEET');
	loadSrcDoc(prompts.docId)
		.then(writeLocalesSheets, traceException)
		.then(gutil.log, traceException);
});

gulp.task('export', () => {
	gutil.log('EXPORT SPREADSHEET');
	loadSrcDoc(prompts.docId)
		.then(exportSrcDoc);
});