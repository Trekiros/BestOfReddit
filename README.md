# Best Of Reddit
A scrapper which generates a google sheet with the top 10 posts of each month for a given subreddit

### Dev workflow
* Install [nodejs](https://nodejs.org/en/)
* Clone the repository locally (or a fork of it): `git clone git@github.com:Trekiros/BestOfReddit.git`
* In your local repository, install code dependencies: `npm i`
* Create a copy of `conf-template.yml`, named `conf.yml`, modifying `conf.yml` for your specific use case.
* Create a Google Sheet, and note its id (from its URI) in `conf.yml`, under the `spreadsheetId` field
* Enable Google Sheets API for your Google API, and download a `credentials.json` file following the instructions found [here](https://developers.google.com/sheets/api/quickstart/nodejs)
* Write down the `client_id`, `project_id` and `client_secret` fields in `conf.yml`, using the values found in `credentials.json`. **Never share or commit these credentials.**
* Run the project for the first time: `npm start` or `node .`
* On the first run, the project will ask you to follow a link to grant it authority over your Google Sheets file.
* It will then create a file named `token.json` which lets it bypass the last step on subsequent runs. **Never share or commit this file.**

### Contributing
To contribute, fork this project, and make a pull request with your changes. 
I will then review the pull request, notably to ensure no changes are made which could compromise users' credentials.

### Deployment workflow (Heroku)
This project could be deployed on any number of platforms. Heroku was chosen as the example because the projects is designed to be ran in a monthly cron job, and Heroku provides free options for this use case.

* Fork this project, and run it locally using the instructions found above. This ensures you have a `conf.yml` and a `token.json` file, which will be needed to configure Heroku.
* Create a Heroku account [here](https://signup.heroku.com/)
* Create a new app
* Create a production pipeline for your app
* In the `Resources` tab, add the `Heroku Scheduler` and `Logentries` add-ons to your pipeline
* Configure `Heroku Scheduler` to run the project periodically. Ideally, this project is to be ran monthly. The project can be ran more often without issue (no duplicate months in the output spreadsheet, or errors), but this would be a waste of computing power.
* Start following logs in real time in `Logentries`, to ensure that things are working properly
* In the `Settings` tab, click `Reveal Config Vars`, and add the following environment variables: 
  * `conf`: copy your local `conf.yml` file
  * `googleToken`: copy your local `token.json` file
* In the `Deployment Method` tab, link the pipeline to your fork of the project. This should launch the project for the first time and automatically detect that it is a nodejs project. You can then re-run it manually from this same tab, but the `Heroku Scheduler` add-on will update it periodically without your input.

### TO DO
- Use the Reddit API directly rather than pushshift
