const axios = require('axios').default
const moment = require('moment')
const fs = require('fs')
const yaml = require('js-yaml')
const GoogleService = require('./src/google').default
const { months, sleep } = require('./src/util').default

async function run() {
    // If you have a no such file error here, make a local copy of conf-template.yml, named conf.yml
    const confFile = fs.readFileSync('./conf.yml')
    const { subreddits, conf, spreadsheet } = yaml.load(confFile)

    const googleService = await GoogleService(spreadsheet)

    const result = await googleService.getRange('A1:B2')

    console.log(result.data.values)

    /*for (let i = 0 ; i < subreddits.length ; i++) {
        const { name: subredditName, exclude: excludeTerms } = subreddits[i]
        console.log(`Starting ${subredditName}...`)

        // Determine where the loop should end, based on the conf
        let earliest
        if (conf.start === 'SUBREDDIT_CREATION') {
            const subredditMetadata = await axios.get(`http://www.reddit.com/r/${subredditName}/about.json`)
            earliest = subredditMetadata.data.data.created_utc * 1000
        } else if (conf.start === 'LAST_MONTH') {
            earliest = moment()
                .startOf('month')
                .subtract(1, 'month')
                .valueOf()
        }

        let fileName = `./output/${subredditName}.csv`
        let fileContent = 'Year,Month,Flair,Title,Author,URL\n' // Headers
    
        let end = moment().startOf('month')
        while (end.isAfter(moment(earliest))) {
            const now = Date.now()
            const start = moment(end).subtract(1, 'month')            
            console.log(`${subredditName} - ${months[start.month()]} ${start.year()}`)

            const query = 'https://api.pushshift.io/reddit/search/submission/?metadata=true&frequency=hour&advanced=false&sort=desc&domain=&sort_type=num_comments'
                + ((excludeTerms && excludeTerms.length) ? `&q=${excludeTerms.map(term => `-"${term}`).join(' ')}"` : '')
                + `&after=${start.valueOf()/1000}`
                + `&before=${end.valueOf()/1000}`
                + `&subreddit=${subredditName}`
                + `&size=${conf.size}`
            fileContent += `${start.year()},${months[start.month()]}\n`
            const response = await axios.get(query)
            response.data.data.forEach(redditPost => {
                const creation = moment(redditPost.created_utc * 1000)
    
                // Print csv row
                fileContent += (
                    `${creation.year()}`
                    + `,${months[creation.month()]}`
                    +`,${redditPost.link_flair_text || '-'}`
                    +`,"${redditPost.title.replace('&amp;', '&').replace('"', '""')}"`
                    +`,/u/${redditPost.author}`
                    +`,${redditPost.full_link}`
                    +'\n'
                )
            })
    
            end = start
    
            // Avoid the "too many requests" error by throttling requests by at least one second
            await sleep(Math.max(100, 1000 - (Date.now() - now)))
        }
    
        fs.writeFileSync(fileName,fileContent,{encoding:'utf8',flag:'w'})
    }*/
}

run().then(() => {}).catch(e => console.error(e))
