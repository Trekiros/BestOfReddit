const axios = require('axios').default
const moment = require('moment')
const fs = require('fs')
const yaml = require('js-yaml')
const GoogleService = require('./src/google').default
const { months, sleep } = require('./src/util').default

async function run() {
    // If you have a no such file error here, make a local copy of conf-template.yml, named conf.yml
    const confFile = process.env['conf'] ? JSON.parse(process.env['conf']) : yaml.load(fs.readFileSync('./conf.yml'))
    const { subreddits, conf, spreadsheet } = confFile

    const googleService = await GoogleService(spreadsheet)

    for (let i = 0 ; i < subreddits.length ; i++) {
        const { name: subredditName, exclude: excludeTerms } = subreddits[i]
        console.log(`Starting ${subredditName}...`)

        // Sheet already exists: start from the first unknown month
        let earliest
        const latestKnownRow = await googleService.getRange(subredditName, 'A2:B2')
        if (latestKnownRow && latestKnownRow[0][0] && latestKnownRow[0][1]) {
            const latestKnownTimestamp = moment().startOf('month')
                .year(latestKnownRow[0][0])
                .month(months.indexOf(latestKnownRow[0][1]))
                .add(1, 'month')

            earliest = latestKnownTimestamp.valueOf()
        }
        
        // Sheet did not exist: start from the subreddit's creation
        else {
            const subredditMetadata = await axios.get(`http://www.reddit.com/r/${subredditName}/about.json`)
            earliest = subredditMetadata.data.data.created_utc * 1000
        }
        
        const rows = []
    
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
            rows.push([start.year(), months[start.month()]])
            const response = await axios.get(query)
            response.data.data.forEach(redditPost => {
                const creation = moment(redditPost.created_utc * 1000)
    
                // Print csv row
                rows.push([
                    creation.year(),
                    months[creation.month()],
                    redditPost.link_flair_text || '-',
                    redditPost.title.replace('&amp;', '&').replace('"', '""'),
                    `/u/${redditPost.author}`,
                    redditPost.full_link,
                ])
            })
    
            end = start
    
            // Avoid the "too many requests" error by throttling requests by at least one second
            await sleep(Math.max(100, 1000 - (Date.now() - now)))
        }
    
        if (rows.length) {
            console.log('Saving on Google Sheets...')
            await googleService.insertRows(subredditName, rows)
            console.log('Saved on Google Sheets.')
        } else {
            console.log(`${subredditName}: nothing to save`)
        }
    }
}

run().then(() => {}).catch(e => console.error(e))
