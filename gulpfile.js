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

const yorc = require('./.yo-rc.json');
const prompts = yorc['generator-trad'].promptValues;

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
				gutil.log('TEXT CONTENT');
				gutil.log(text);
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
	gutil.log(output.languages);
	gutil.log(_.map(sheets, l => l.title));
	gutil.log(_.map(langSheets, l => l.title));

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

	//loadAirportDoc();
	gutil.log('INIT/UPDATE SPREADSHEET');
	loadSrcDoc(prompts.docId)
		.then(writeLocalesSheets, traceException)
		.then(gutil.log, traceException);
});

gulp.task('export', () => {
	gutil.log('EXPORT SPREADSHEET');
	loadSrcDoc(prompts.docId)
		.then(exportSrcDoc);
})

/**
CONF
**/
/*
const creds 				= require('./tools/BiborgxAirFrance-8427dfb84c29.json');
const doc_src_locales_id 	= '18blG429Na8dbb6km_EVRaDy2yqD9wStTIUd52afkEVw'; //locales are determined from this document with col: "Code pays" and "Langue 1"
const doc_dest_id			= '1ZrlHHMfgYiGlwhA5amLoQuAr6b2-3IKlReExOdYpeKg'; //final document, from which will be extracted the json file
const doc_src_id 			= '1ywIzb5BDyE6Mzs38t6LXChYyjrvJ53A5-Ym7jqDPUg8'; //source document with translated texts
const doc_airport_id 		= '1TCDM9ox89eHbVLQnqOUKM6qBbr9julvYHpqXahdj5y8' //document with airport / city code / city names

const IS_DEBUG 				= false;
const max_text_ids_rows 	= 20; //to optimize text id injecting in locale sheets => should be AT LEAST the number of txt ids in source sheet: mapping_text



//ligne de depart des aeroport
const airport_start_row = max_text_ids_rows+1;

const max_languages = IS_DEBUG ? 10 : 1000; 
const max_airports 	= IS_DEBUG ? 20 : 1000; 





var doc_dest = null;
var src_sheets = [];
var dst_sheets = [];
var mapping = {};
var airports_trad = {};
var dst_values = {};
var map_languages_sheet = null;
var map_languages = {};
var locale_list = [];
var locale_errors_sheet = null;
var locale_found_sheet = null;
var locale_errors_list = [];

var src_options = {
	meta_sheets: ["mapping_text", "mapping_lang", "errors_locales", "locales_found"] //sheets other than localization sheets in destination doc
}


gulp.task('default', () => {

  //loadAirportDoc();
  loadSrcDoc();
});

var buildMapping = (map_sheet) => {
	gutil.log("######################  BUILD MAP #######################");
	map_sheet.getCells({
	  'max-row':max_text_ids_rows,
	  'max-col':2,
      'return-empty': true
    }, function(err, cells) {
		var cellNum = cells.length;
		for(var i = 0;  i < cellNum; ++i){
			cell = cells[i];
			//gutil.log('Cell R'+cell.row+'C'+cell.col+' = '+cell.value);
			if(cell.col == 2 && cell.value && cells[i-1].row == cell.row)
			{
				gutil.log( sanitizeKey(cell.value) ) ;
				mapping[sanitizeKey(cell.value)] = sanitizeKey(cells[i-1].value)
			}
		}
		gutil.log("######################  MAP #######################");
		gutil.log(mapping);
		
		mapLocales();

    });
}

var mapAllSheets = () => {
	gutil.log("###################### START MAPPING #######################");
	var sheetCount = src_sheets.length;
	doMapping(1, sheetCount-1); 
}

var sanitizeKey = (str) => {
	return str.replace("\n", "").toLowerCase();
}

var writeValues = () => {
	var sheetCount = dst_sheets.length;
	writeSheet(src_options.meta_sheets.length, sheetCount-1); 
}

var write_airport = (cells, locale) => {
	locale = locale.toLowerCase().substring(0,2);
	airports = airports_trad[locale];
	
	gutil.log("###################### WRITE AIPORTS FOR : "+locale+" #######################");
	
	if(!airports)
	{
		gutil.log("AIRPORTS NOT FOUND....");
		gutil.log(airports);
		return;
	}
	else
	{
		gutil.log(airports.length + " AIRPORTS FOUND....");
		gutil.log(airports[0]);
	}
		
	
	var cellNum = cells.length;
	for(var i = 0;  i < cellNum; ++i){
			var cell = cells[i];
			if(cell.row >= airport_start_row)
			{
				var airport_id = cell.row - airport_start_row;
				var airport = airports[airport_id];
				
				if(!airport)
					continue;
				
				
				if(cell.col == 1)
				{
					cell.value = airport.city_code;
				}
				else if(cell.col == 3){
					cell.value =airport.city_name;
				}
				
			}
		}
}

var writeSheet = (sid, smaxid) => {

	var dst_sheet = dst_sheets[sid];
	gutil.log("###################### START WRITING : "+dst_sheet.title+" #######################");
	var locale = dst_sheet.title.toLowerCase();
	var lg = locale.substring(0, 2);
	var country = locale.substring(3, 2);

	
	if( dst_sheet.title.length > 5)
	{
		writeSheet(++sid, smaxid);
		return;
	}

	dst_sheet.getCells({
		'max-col':3,
      'return-empty': true
    }, function(err, cells) {
		gutil.log(err);
		
		var cellNum = cells.length;
		for(var i = 0;  i < cellNum; ++i){

			var cell = cells[i];
			if(parseInt(cell.row) >= airport_start_row) //row > 100 only needed for airports label
				break;
		
			
			if(cell.col == 1 && cell.value){
				var key = sanitizeKey(cell.value)
				var txts = dst_values[locale];

				if(!txts)
				{
					gutil.log(`ERROR: LOCALE ${locale} NOT FOUND IN dst_values`);
					locale_errors_list.push(locale);
					continue;
				}

				var content = txts[cell.value];
				gutil.log("["+cell.row+"] " + key+" => "+ content);
				
				if(content)
				{
					var dst_cell = cells[i+2] ;
					if(dst_cell.row == cell.row){
						dst_cell.value =  content;
					}
					else
					{
						gutil.log("ERROR: DST CELL IS NOT ON THE SAME ROW ");
					}
				}
					
			}
		}
		
		write_airport(cells, dst_sheet.title);
		
		
		if( ++sid <= smaxid)
		{
			dst_sheet.bulkUpdateCells(cells, () => {
				writeSheet(sid, smaxid);
			}); //async 
		}
		else{
			dst_sheet.bulkUpdateCells(cells, () =>{
				onSheetsWritten();
			}); //async 
		}
		
	});
}

var onSheetsWritten = () => {
	gutil.log("###################### WRITING COMPLETE #######################");
	writeLocaleErrors();
}

var writeLocaleErrors = () => {
	gutil.log("###################### WRITING ERRORS #######################");
	locale_errors_list = _.uniq(locale_errors_list);
	locale_errors_sheet.getCells({
	  'max-col':1,
      'return-empty': true
    }, function(err, cells) {
		if(err)
		{
			gutil.log("ERROR!! #####################################################################");
			gutil.log(err);
		}
		var errNum = locale_errors_list.length;
		for(var i = 0;  i < errNum; ++i){
			cells[i].value = locale_errors_list[i];
		}
		
		locale_errors_sheet.bulkUpdateCells(cells, () => {
			gutil.log("###################### WRITING ERRORS COMPLETE #######################");
			writeLocaleFound();
		}); //async 
		
    });
}


var writeLocaleFound = () => {
	gutil.log("###################### WRITING LOCALES FOUND #######################");
	locale_found_sheet.getCells({
	  'max-col':1,
      'return-empty': true
    }, function(err, cells) {
		if(err)
		{
			gutil.log("ERROR!! #####################################################################");
			gutil.log(err);
		}
		var locNum = locale_list.length;
		for(var i = 0;  i < locNum; ++i){
			gutil.log(locale_list[i]);
			cells[i].value = locale_list[i];
		}
		
		locale_found_sheet.bulkUpdateCells(cells, () => {
			gutil.log("###################### WRITING LOCALES COMPLETE #######################");
			var fileName = "locales.json"
			var dest = "./tools/"
			var data = {
				count:locale_list.length,
				data:locale_list
			}
			writeJsonFile(fileName, dest, data);
		}); //async 
		
    });
}

var doMapping = (sid, smaxid) =>
{
	var src_sheet = src_sheets[sid];
	gutil.log("###################### START MAP SHEET : "+src_sheet.title+" #######################");
	src_sheet.getCells({
      'return-empty': true
    }, function(err, cells) {
		if(err)
		{
			gutil.log("ERROR!! #####################################################################");
			gutil.log(err);
		}
		var cellNum = cells.length;
		for(var i = 0;  i < cellNum; ++i){
			var cell = cells[i];
			var key = sanitizeKey(cell.value);
			var match = mapping[key];
			if(cell.col == 1 )
			{
				if(match)
				{
					var country_cell = cells[i+1]
					var lg_cell = cells[i+2]
					var trad_cell = cells[i+3]
					var country = country_cell.value.toLowerCase();
					var lg = lg_cell.value.toLowerCase();
					var locale = `${lg}-${country}`;

					gutil.log( "["+locale+"]" + key + " => " + trad_cell.value);
					
					if( ! dst_values[locale] )
						dst_values[locale] = {};
						
					var mapped_key = mapping[key];
					dst_values[locale][mapped_key] = trad_cell.value;
				}
			}
			
		}
		
		if( sid < smaxid)
		{
			doMapping(++sid, smaxid);
		}
		else{
			gutil.log("###################### MAPPING COMPLETE #######################");
			gutil.log(dst_values);
			writeValues();
		}
		
    });
}

  
  function onCellSaved(e){
	gutil.log(e);
  }
  
  
var getInfoAndWorksheets = (step) => {
    doc.getInfo(function(err, info) {
      console.log('Loaded doc: '+info.title+' by '+info.author.email);
      sheet = info.worksheets[0];
      console.log('sheet 1: '+sheet.title+' '+sheet.rowCount+'x'+sheet.colCount);
	  
	  workingWithRows(sheet);
      
    });
  }

var loadSrcDoc = () => {

    var doc_src = new GoogleSpreadsheet(doc_src_id);

    doc_src.useServiceAccountAuth(creds, function(err){
        if(err){
            gutil.log(err);
        }else{
            
            doc_src.getInfo( function( err, sheet_info ){
                if(err){
                    gutil.log(err);
                }else{
                    gutil.log( sheet_info.title + ' is loaded' );
                    var sheetCount = sheet_info.worksheets.length;
					src_sheets = sheet_info.worksheets;
                    for(var i=0,c=sheet_info.worksheets.length;i<c;i++){
                        var sheet = sheet_info.worksheets[i];
						gutil.log( sheet.title + ' sheet found' );
                    }
					
					loadDestDoc();
                }
            });
            
        }

    });
}

var loadSrcLangDoc = () =>{
	var doc_src_locales = new GoogleSpreadsheet(doc_src_locales_id);
	doc_src_locales.useServiceAccountAuth(creds, function(err){
        if(err){
            gutil.log(err);
        }else{
            
            doc_src_locales.getInfo( function( err, sheet_info ){
                if(err){
                    gutil.log(err);
                }else{
                    gutil.log( sheet_info.title + ' is loaded' );
                    var sheetCount = sheet_info.worksheets.length;
					var map_sheet = null;
                    for(var i=0,c=sheet_info.worksheets.length;i<c;i++){
						var sheet = sheet_info.worksheets[i];
                        gutil.log( sheet.title + ' sheet found' );
						
						if( sheet.title == "Currencies & languages by marke"){
							parseLocales(sheet);
						}
                    }
					
					//buildMapping(map_sheet);
							
                }
            });
            
        }
    });
}


var isLocaleSheetExists = (locale) => {
	var msheets = _.filter(dst_sheets, (s) => s.title == locale);
	return msheets.length > 0;
}

var getLocaleSheets = (sheet_info) => {
	dst_sheets = [] ; //sheet_info.worksheets;
	var map_sheet = null;
	var num_sheets = sheet_info.worksheets.length < (max_languages+src_options.meta_sheets.length) ? sheet_info.worksheets.length : (max_languages+src_options.meta_sheets.length);
    for(var i=0;i<num_sheets;i++){
		var sheet = sheet_info.worksheets[i];
        gutil.log( sheet.title + ' sheet found' );
		
		if( _.indexOf(src_options.meta_sheets, sheet.title) > -1){
			continue;
		}
		else
			dst_sheets.push(sheet);
    }
}

var deleteLocaleSheets = (sheet_info) => {
	dst_sheets = [] ; //sheet_info.worksheets;
	var map_sheet = null;
    for(var i=0,c=sheet_info.worksheets.length;i<c;i++){
		var sheet = sheet_info.worksheets[i];
        gutil.log( sheet.title + ' sheet found' );
		
		if( _.indexOf(src_options.meta_sheets, sheet.title) > -1){
			continue;
		}
		else
			sheet.del();
    }
}


var reloadLocaleSheets = (callback) => {     
    doc_dest.getInfo( function( err, sheet_info ){
        if(err){
            gutil.log(err);
        }else{
            
            getLocaleSheets(sheet_info);
            callback();
        }
    });
}

var addLocaleSheetsIds = () => {

		gutil.log("######################  ADDING IDs TO LOCALE SHEETS #######################");
		var localesNum = locale_list.length;
		addLocaleSheetIds(0, localesNum);
}

var addLocaleSheetIds = (sid, smax) => {

	var sheet = dst_sheets[sid];
	var mappingArr = _.toPairs(mapping);

	sheet.getCells({
	  'min-row':2,
	  'max-row':max_text_ids_rows,
	  'max-col':1,
      'return-empty': true
    }, function(err, cells) {
		var txtIdNum = mappingArr.length;
		gutil.log("cells: " + cells.length);
		for(var i = 0; i <txtIdNum; ++i){
			//gutil.log(`[${i}] ${mappingArr[i][0]}`);
			cells[i].value = mappingArr[i][1];		
		}

		if( ++sid < smax)
		{
			sheet.bulkUpdateCells(cells, function(){
				addLocaleSheetIds(sid, smax);
			}); //async 
		}
		else{
			sheet.bulkUpdateCells(cells, function(){
				onLocaleSheetIdAdded();
			}); //async 
		}
    });
}

var onLocaleSheetIdAdded = () => {
	gutil.log("###################### ADDING IDs TO LOCALE SHEETS COMPLETE #######################");
	loadAirportDoc();
}


var addLocaleSheets = () => {
	var localesNum = locale_list.length;
	gutil.log(`######################  ADDING LOCALE SHEETS ( ${localesNum} ) #######################`);
	
	addLocaleSheet(0, localesNum);
}


var addLocale = (lg, country) => {
	gutil.log("FOUND LOCALE: " + lg + "-" +  country.toUpperCase() );
	locale_list.push(lg + "-" + country);

}

var addLocaleSheet = (sid, smax) => {
	var locale = locale_list[sid];
	var options = {
		title: locale,
		rowCount: 2000,
		colCount: 3,
		headers: ["String_ID","Text"]
	};

	if( isLocaleSheetExists(locale) )
	{
		gutil.log(`###################### [${sid}/${smax}] ${locale} ALREADY ADDED #######################`);
		addNextLocaleSheet(sid, smax);
		return;	
	}

	doc_dest.addWorksheet(options, (err, sheet) =>{
		if(err)
		{
			gutil.log(err);
		}
		else
			gutil.log("###################### "+sheet.title+" ADDED #######################");

		addNextLocaleSheet(sid, smax);

	})
}

var addNextLocaleSheet = (sid, smax) => {
	if(++sid < smax )
		addLocaleSheet(sid, smax);
	else
		onLocaleSheetsAdded();		
}

var onLocaleSheetsAdded = () => {
	reloadLocaleSheets(addLocaleSheetsIds);
};

var parseLocales = (sheet) =>{

	gutil.log("######################  GET USED LOCALES WITH SHEET : " +sheet.title+"#######################");
	sheet.getCells({
	  'min-row':2,
      'return-empty': false
    }, function(err, cells) {
		var cellNum = cells.length;
		for(var i = 1;  i < cellNum; ++i){
			cell = cells[i];
			
			if( cell.col == 2)
			{
				var lg_cell = cells[i+5];
				if( lg_cell.row != cell.row)
					gutil.log("NOT SAME ROW!! => " + cell.row + "x" + cell.col);

				addLocale(map_languages[lg_cell.value], cell.value);

				//only used in DEBUG
				if(locale_list.length >= max_languages)
					break;
			}
		}


		locale_list.sort();
		var uniques_locales = _.uniq(locale_list);

		gutil.log("###################### "+uniques_locales.length+" UNIQUES LOCALES FOUNDS #######################");
		if( uniques_locales.length != locale_list.length)
		{
			gutil.log("###################### "+(locale_list.length - uniques_locales.length)+" DUPLICATED LOCALES FOUNDS #######################");
		}
		
		locale_list = uniques_locales ;

		gutil.log(locale_list);

		addLocaleSheets();

		
    });

	
}

function loadDestDoc(){
	doc_dest = new GoogleSpreadsheet(doc_dest_id);
	doc_dest.useServiceAccountAuth(creds, function(err){
        if(err){
            gutil.log(err);
        }else{
            
            doc_dest.getInfo( function( err, sheet_info ){
                if(err){
                    gutil.log(err);
                }else{
                    gutil.log( sheet_info.title + ' is loaded' );
                    var sheetCount = sheet_info.worksheets.length;
					var map_sheet = null;
                    for(var i=0,c=sheet_info.worksheets.length;i<c;i++){
						var sheet = sheet_info.worksheets[i];
                        gutil.log( sheet.title + ' sheet found' );
						
						if( sheet.title == "mapping_text"){
							map_sheet = sheet;
						}
						else if( sheet.title == "mapping_lang"){
							map_languages_sheet = sheet;
						}
						else if( sheet.title == "errors_locales"){
							locale_errors_sheet = sheet;
						}
						else if( sheet.title == "locales_found"){
							locale_found_sheet = sheet;
						}
                    }

                    getLocaleSheets(sheet_info);

                    //deleteLocaleSheets(sheet_info);
					buildMapping(map_sheet);
					
                }
            });
            
        }

    });
}


function loadAirportDoc(){
	var doc_airport = new GoogleSpreadsheet(doc_airport_id);
	doc_airport.useServiceAccountAuth(creds, function(err){
        if(err){
            gutil.log(err);
        }else{
            
            doc_airport.getInfo( function( err, sheet_info ){
                if(err){
                    gutil.log(err);
                }else{
                    gutil.log( sheet_info.title + ' is loaded' );
                    var sheetCount = sheet_info.worksheets.length;
					var map_sheet = null;
                    for(var i=0;i<sheetCount;i++){
						var sheet = sheet_info.worksheets[i];
                        gutil.log( sheet.title + ' sheet found' );
						
						if( sheet.title  == "city_translation")
							feedAirportData(sheet)
                    }
					
					
                }
            });
			
            
        }

    });
}

var onAirportDataFed = () =>{
	gutil.log("######################  AIRPORT TRANSLATION COMPLETE #######################");
	mapAllSheets();
}

function feedAirportData(sheet){
	gutil.log("######################  PARSE AIRPORT TRANSLATION #######################");

	var airportsLangCol = {};
	var citiesCol = {};

	sheet.getCells({
	  'min-row':1,
	  'max-row':max_airports,
      'return-empty': true
    }, function(err, cells) {

    	if(err)
    		gutil.log(err);

		var cellNum = cells.length;
		for(var i = 1;  i < cellNum; ++i){
			cell = cells[i];

			//parse headers
			if(cell.row == 1)
			{
				var cellHash = cell.value.split(" ");
				gutil.log(cellHash);
				if(cellHash.length == 3 && cellHash[2].length == 2 )
				{
					var locale = cellHash[2].toLowerCase();
					airports_trad[locale] = [];
					airportsLangCol[cell.col] = locale;
					gutil.log("ADD LOCALE FOR AIRPORTS: " + locale);
				}

			}

			//map row / city_code
			if(cell.col == 6)
			{
				citiesCol[cell.row] = cell.value;
			}
			

			if( cell.col > 6)
			{
				var locale = airportsLangCol[cell.col];
				var city_code = citiesCol[cell.row];
				if(!locale)
					continue;

				airports_trad[locale].push({
					city_code:city_code,
					city_name:cell.value
				});
			}

		}
		onAirportDataFed();
    });
}

var mapLocales = () =>{
	gutil.log("######################  START LOCALES MAPPING #######################");	
	map_languages_sheet.getCells({
      'return-empty': false
    }, function(err, cells) {
		var cellNum = cells.length;
		for(var i = 0;  i < cellNum; ++i){
			cell = cells[i];
			if(cell.col == 1){
				map_languages[cell.value] = cells[i+1].value;
			}
		}
		gutil.log("######################   LOCALES MAPPING COMPLETE #######################");
		gutil.log(map_languages);

		loadSrcLangDoc();
    });
}

gulp.task('fetch-data', function ()
{
   gpsheetLangImport('tools/lang');
});

var filterFieldNameCell   = cell => cell.row == 1;
var cellToColValue    = cell => [cell.col, cell.value];
var formatCell        = cell => {return {row:cell.row, col:cell.col, value:cell.value}};


function gpsheetLangImport(dest){

    var my_sheet = new GoogleSpreadsheet(doc_dest_id);

    my_sheet.useServiceAccountAuth(creds, function(err){
        if(err){
            gutil.log(err);
        }else{
            
            my_sheet.getInfo( function( err, sheet_info ){
                if(err){
                    gutil.log(err);
                }else{
                    gutil.log( sheet_info.title + ' is loaded' );
                    var sheetCount = sheet_info.worksheets.length;


                    var sid = src_options.meta_sheets.length;
                    var smax = sheetCount;
                    parseLangSheet(sheet_info.worksheets, dest, sid, smax);
                }
            });
            
        }

    });
}

function parseLangSheet(worksheets, dest, sid, smax){
	var sheet = worksheets[sid];

    gutil.log("Starting sheet : "+sheet.title);

    sheet.getCells( function( err, cells ){

    	gutil.log(err);

        gutil.log('[sheet '+sheet.title+' start]');

        if( err )
       	{
       		console.log(err);
       		return;
       	}

        gutil.log('[sheet '+sheet.title+'] : '+cells.length+' row parsed');

        var fileName = sheet.title + "_af_language.json"
        gutil.log('Filename '+ fileName);

        var data = _.chain(cells)
                      .filter(cell => cell.row > 1)
                      .map(formatCell)
                      .groupBy(cell => cell.row)
                      .toPairs()
                      .map(r => r[1])
					  .filter(row => row[0] && row[1] )
                      .map(row => { return [row[0].value, row[1].value]})
                      .fromPairs()
                      .value();

        writeJsonFile(fileName, dest, data);

        if(++sid < smax)
        	parseLangSheet(worksheets, dest, sid, smax);
    });
    
}

function writeJsonFile(filename, dest, content){
  writeFile(filename, dest, JSON.stringify(content, null, 2));
}

function writeFile(filename, dest, content){
    var stream = new Readable({objectMode: true});
    stream._read = function ()
    {
    };

    var joinedFile = new File({
        base: process.cwd(),
        path: path.join(process.cwd(), filename),
        contents: new Buffer(content)
    });

    stream.push(joinedFile);
    stream.push(null);

    stream.pipe(gulp.dest(dest));
}
*/