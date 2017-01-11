[![Build Status](https://travis-ci.org/Kemicalish/generator-trad.svg?branch=master)](https://travis-ci.org/Kemicalish/generator-trad)
[![Coverage Status](https://coveralls.io/repos/github/Kemicalish/generator-trad/badge.svg?branch=master)](https://coveralls.io/github/Kemicalish/generator-trad?branch=master)

# generator-trad
Generate Google Spreadsheet dedicated to localization and output them to JSON

## Installing / Getting started

If you not already have Yeoman, install it globally
```shell
npm install -g yo
```

then install this generator
```shell
npm install --save-dev generator-trad 
```

If your spreadsheet isn't correctly setup yet, follow: **The Spreadsheet Setup** section before you run the generator

Then run the generator to feed the spreadsheet with all needed localized sheets
```shell
yo trad
```

After your sheets have been localized, export their content in json to your output directory
```shell
yo trad:export
```

## The Spreadsheet Setup
your spreadsheet should looks like this at first:
https://docs.google.com/spreadsheets/d/1AdhlrK2aIVla4Zm34xVmy-rW2Fiw532GKrnSM0WWRvY

The doc should contain 2 sheets:
 - languages: the sheet should contain one col with the list of needed locales 
 - master: the sheet where all text to localize is first set, with 2 cols. First one for text id, the second for source text to translate.

**IMPORTANT: on both sheets first row is for header and won't be parsed!**
 

## Authentication

This is a 2-legged oauth method and designed to be "an account that belongs to your application instead of to an individual end user".
Use this for an app that needs to access a set of documents that you have full access to.
([read more](https://developers.google.com/identity/protocols/OAuth2ServiceAccount))

__Setup Instructions__

1. Go to the [Google Developers Console](https://console.developers.google.com/project)
2. Select your project or create a new one (and then select it)
3. Enable the Drive API for your project
  - In the sidebar on the left, expand __APIs & auth__ > __APIs__
  - Search for "drive"
  - Click on "Drive API"
  - click the blue "Enable API" button
4. Create a service account for your project
  - In the sidebar on the left, click  __Credentials__
  - Click blue "Create credentials" button
  - Select the "Service account" option
  - Select the "Compute Engine" option
  - Select the "JSON" key type option
  - Click blue "Create" button
  - your JSON key file is generated and downloaded to your machine (__it is the only copy!__)
  - open the generated file and copy the "client_email" value (should be like: XXXXXXXXXXXXX-compute@developer.gserviceaccount.com)
  - **This file will be further refered as credentials.json**
5. Share the doc (or docs) with your service account using the email noted above

**Note: You can reuse these credentials with any number of google spreadsheets as long as you share the doc with these credentials email adress**


