const moment = require('moment')
const fs = require('fs')
const yaml = require('js-yaml')
const GoogleService = require('./src/google').default
const { months, sleep, httpGet } = require('./src/util').default

async function run() {
    // If you have a no such file error here, make a local copy of conf-template.yml, named conf.yml
    const confFile = process.env['conf'] || fs.readFileSync('./conf.yml')
    const { subreddits, conf, spreadsheet } = yaml.load(confFile)

    const googleService = await GoogleService(spreadsheet, subreddits)

    // fori instead of foreach in order to stay in the async scope
    for (let i = 0 ; i < subreddits.length ; i++) {
        const { name: subredditName, exclude: excludeTerms } = subreddits[i]
        console.log(`Starting ${subredditName}...`)

        // Calculate timeslot of the job
        const earliest = await googleService.getEarliest(subredditName)
        const latest = moment().subtract(5, 'days').startOf('month') // If ran daily, the sheet is updated on the 5th of each month

        let start = moment(earliest)
        while (start.isBefore(latest)) {
            const end = moment(start).add(1, 'month')            
            console.log(`${subredditName} - ${months[start.month()]} ${start.year()}`)
            
            const rows = []
            rows.push([start.year(), months[start.month()]])

            const query = 'https://api.pushshift.io/reddit/search/submission/?metadata=true&frequency=hour&advanced=false&sort=desc&domain=&sort_type=num_comments'
                + ((excludeTerms && excludeTerms.length) ? `&q=${excludeTerms.map(term => `-"${term}`).join(' ')}"` : '')
                + `&after=${start.valueOf()/1000}`
                + `&before=${end.valueOf()/1000}`
                + `&subreddit=${subredditName}`
                + `&size=${conf.size}`
            const response = await httpGet(query)
    
            await googleService.insertTop(subredditName, {
                month: months[start.month()],
                year: start.year(),
                top: response.map(redditPost => ({
                    flair: redditPost.link_flair_text || '-',
                    title: redditPost.title.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('"', '""'),
                    author: redditPost.author,
                    url: `http://www.reddit.com/${redditPost.id}`,
                }))
            })
            
            // Avoid the "too many requests" error by throttling requests by at least one second
            await sleep(1000)
            start = end
        }
    }
}

run()
    .then(() => {
        console.log('Job execution complete.')
    })
    .catch(console.error)
